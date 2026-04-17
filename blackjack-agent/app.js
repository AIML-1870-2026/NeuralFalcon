// Blackjack AI Agent — game engine + UI orchestration

// ─── State ───────────────────────────────────────────────
const G = {
    deck: [],
    playerHands: [[]], // supports split
    activeHandIdx: 0,
    dealerHand: [],
    balance: 1000,
    currentBet: 0,
    handBets: [0],
    phase: 'betting', // betting | playing | dealer | done
    apiKey: null,
    pendingAction: null,
    explainDepth: 'standard',
    playStyle: 'balanced',
    runningCount: null,
    seenCards: [],
    sessionHandHistory: [],
    voiceEnabled: false,
    tournamentMode: false,
    tournamentHands: 0,
    tournamentHandsLeft: 0,
    tournamentStartBalance: 0,
    compareModel: null,
    theme: 'dark',
};

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set(['♥','♦']);

// ─── Deck ─────────────────────────────────────────────────
function cardValue(rank) {
    if (rank === 'A') return 11;
    if (['J','Q','K'].includes(rank)) return 10;
    return parseInt(rank);
}

function createDeck() {
    const deck = [];
    for (const suit of SUITS)
        for (const rank of RANKS)
            deck.push({ rank, suit, value: cardValue(rank) });
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function ensureDeck() {
    if (G.deck.length < 15) {
        G.deck = shuffle(createDeck());
        G.seenCards = [];
        agentLog('info', 'Deck reshuffled');
    }
}

function dealCard(faceUp = true) {
    ensureDeck();
    const card = G.deck.pop();
    if (faceUp) G.seenCards.push(card);
    return { ...card, faceUp };
}

// ─── Hand Math ───────────────────────────────────────────
function handTotal(hand) {
    let total = 0, aces = 0;
    for (const c of hand) {
        if (!c.faceUp) continue;
        total += c.value;
        if (c.rank === 'A') aces++;
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    const isSoft = aces > 0 && total <= 21;
    return { total, isSoft };
}

function isBlackjack(hand) {
    return hand.length === 2 && handTotal(hand).total === 21;
}

function isBust(hand) { return handTotal(hand).total > 21; }

function canDouble(hand) {
    return hand.length === 2 && G.balance >= G.currentBet;
}

function canSplit(hand) {
    return hand.length === 2 &&
        hand[0].rank === hand[1].rank &&
        G.playerHands.length < 4 &&
        G.balance >= G.currentBet;
}

// ─── Rendering ───────────────────────────────────────────
function cardHTML(card) {
    if (!card.faceUp) return `<div class="card face-down">🂠</div>`;
    const red = RED_SUITS.has(card.suit) ? ' red' : '';
    return `<div class="card${red}">${card.rank}${card.suit}</div>`;
}

function renderHands() {
    // Dealer
    const { total: dt } = handTotal(G.dealerHand);
    const dealerVisible = G.dealerHand.filter(c => c.faceUp).length;
    document.getElementById('dealer-total').textContent =
        G.phase === 'playing' ? `(${dealerVisible === G.dealerHand.length ? dt : '?'})` : `(${dt})`;
    document.getElementById('dealer-hand').innerHTML = G.dealerHand.map(cardHTML).join('');

    // Player (multi-hand for split)
    const playerArea = document.getElementById('player-area');
    playerArea.innerHTML = '';
    G.playerHands.forEach((hand, idx) => {
        const { total, isSoft } = handTotal(hand);
        const isActive = idx === G.activeHandIdx;
        const bj = isBlackjack(hand) ? ' 🂱' : '';
        const bust = isBust(hand) ? ' BUST' : '';
        const div = document.createElement('div');
        div.className = 'hand-group' + (isActive && G.phase === 'playing' ? ' active-hand' : '');
        div.innerHTML = `
            <h3>Hand ${G.playerHands.length > 1 ? idx + 1 : ''}
                <span class="total-badge ${isSoft ? 'soft' : ''}">${total}${isSoft?' soft':''}${bj}${bust}</span>
            </h3>
            <div class="cards-row">${hand.map(cardHTML).join('')}</div>
            <div class="bet-badge">Bet: $${G.handBets[idx] || G.currentBet}</div>`;
        playerArea.appendChild(div);
    });
}

function renderBalance() {
    document.getElementById('balance').textContent = G.balance;
    document.getElementById('current-bet').textContent = G.currentBet;
}

function renderDeckTracker() {
    const el = document.getElementById('deck-tracker');
    if (!el) return;
    const counts = {};
    RANKS.forEach(r => counts[r] = 0);
    G.seenCards.forEach(c => counts[c.rank]++);
    const remaining = G.deck.length;
    el.innerHTML = RANKS.map(r => {
        const seen = counts[r];
        const total = r === '10' ? 16 : 4;
        const pct = Math.round(((total - seen) / remaining) * 100);
        return `<span class="rank-count" title="${r}: ${total - seen} left">
            ${r}<small>${pct}%</small></span>`;
    }).join('') + `<span class="deck-remaining">${remaining} cards left</span>`;
}

function renderBetSizeHint() {
    const el = document.getElementById('bet-hint');
    if (!el || G.phase !== 'betting') return;
    let suggestedMin = 5, suggestedMax = 25, reason = 'Standard balanced play.';
    if (G.playStyle === 'conservative') {
        suggestedMin = 5; suggestedMax = Math.min(10, Math.floor(G.balance * 0.02));
        reason = 'Conservative: keep bets low to minimize variance.';
    } else if (G.playStyle === 'aggressive') {
        suggestedMin = 25; suggestedMax = Math.min(100, Math.floor(G.balance * 0.1));
        reason = 'Aggressive: larger bets maximize EV.';
    }
    if (G.runningCount !== null && G.runningCount > 2) {
        suggestedMin = Math.min(50, suggestedMin * 2);
        suggestedMax = Math.min(200, suggestedMax * 2);
        reason += ` Count is +${G.runningCount}: bet more.`;
    }
    el.textContent = `AI Bet Suggestion: $${suggestedMin}–$${suggestedMax}. ${reason}`;
}

// ─── Phase + Button State ─────────────────────────────────
function setPhase(phase) {
    G.phase = phase;
    const betting = phase === 'betting';
    const playing = phase === 'playing';

    document.getElementById('deal-btn').disabled = !betting || G.currentBet === 0 || !G.apiKey;
    document.getElementById('get-advice-btn').disabled = !playing;
    document.getElementById('execute-btn').disabled = true;

    document.getElementById('chip-selector').style.opacity = betting ? '1' : '0.4';
    document.getElementById('chip-selector').style.pointerEvents = betting ? '' : 'none';
    document.getElementById('clear-bet').disabled = !betting;

    if (betting) {
        G.pendingAction = null;
        document.getElementById('recommended-action').textContent = '';
        document.getElementById('ai-reasoning').textContent = '';
        renderBetSizeHint();
    }
    if (phase === 'done') renderPostMortem();
}

// ─── Bet Controls ─────────────────────────────────────────
function addBet(amount) {
    if (G.phase !== 'betting') return;
    if (G.currentBet + amount > G.balance) {
        showToast('Bet exceeds balance.', 'warn'); return;
    }
    G.currentBet += amount;
    renderBalance();
    document.getElementById('deal-btn').disabled = G.currentBet === 0 || !G.apiKey;
    renderBetSizeHint();
}

function clearBet() {
    if (G.phase !== 'betting') return;
    G.currentBet = 0;
    renderBalance();
    document.getElementById('deal-btn').disabled = true;
}

// ─── Deal ─────────────────────────────────────────────────
function deal() {
    if (G.currentBet === 0 || !G.apiKey) return;
    G.balance -= G.currentBet;
    G.playerHands = [[dealCard(), dealCard()]];
    G.handBets = [G.currentBet];
    G.activeHandIdx = 0;
    G.dealerHand = [dealCard(), dealCard(false)]; // hole card face down
    G.sessionHandHistory.push({ startBalance: G.balance + G.currentBet, bet: G.currentBet, steps: [] });
    renderBalance();
    renderHands();
    renderDeckTracker();
    agentLog('info', 'Hand dealt', {
        player: G.playerHands[0].map(c => c.rank + c.suit),
        dealer: G.dealerHand[0].rank + G.dealerHand[0].suit + ' [hole]',
        balance: G.balance,
        bet: G.currentBet,
    });

    if (isBlackjack(G.playerHands[0])) {
        revealDealerHole();
        if (isBlackjack(G.dealerHand)) {
            endHand('push');
        } else {
            endHand('blackjack');
        }
        return;
    }
    setPhase('playing');
    updateStrategyHighlight();
}

// ─── Player Actions ───────────────────────────────────────
function executeAction(action) {
    const hand = G.playerHands[G.activeHandIdx];
    const step = { action, handBefore: hand.map(c => c.rank + c.suit) };
    G.sessionHandHistory.at(-1)?.steps.push(step);

    document.getElementById('execute-btn').disabled = true;
    document.getElementById('get-advice-btn').disabled = true;

    if (action === 'hit') {
        hand.push(dealCard());
        renderHands();
        renderDeckTracker();
        updateStrategyHighlight();
        if (isBust(hand)) {
            agentLog('info', 'Player busts', { hand: hand.map(c => c.rank) });
            if (!nextHand()) endHand('loss');
        } else {
            setPhase('playing');
        }
    } else if (action === 'stand') {
        if (!nextHand()) dealerPlay();
    } else if (action === 'double') {
        if (!canDouble(hand)) { showToast("Can't double here.", 'warn'); setPhase('playing'); return; }
        G.balance -= G.handBets[G.activeHandIdx];
        G.handBets[G.activeHandIdx] *= 2;
        hand.push(dealCard());
        renderHands();
        renderBalance();
        renderDeckTracker();
        if (isBust(hand)) {
            if (!nextHand()) endHand('loss');
        } else {
            if (!nextHand()) dealerPlay();
        }
    } else if (action === 'split') {
        if (!canSplit(hand)) { showToast("Can't split here.", 'warn'); setPhase('playing'); return; }
        G.balance -= G.currentBet;
        const newHand = [hand.pop(), dealCard()];
        hand.push(dealCard());
        G.playerHands.splice(G.activeHandIdx + 1, 0, newHand);
        G.handBets.splice(G.activeHandIdx + 1, 0, G.currentBet);
        renderHands();
        renderBalance();
        renderDeckTracker();
        updateStrategyHighlight();
        setPhase('playing');
    }
}

function nextHand() {
    if (G.activeHandIdx < G.playerHands.length - 1) {
        G.activeHandIdx++;
        renderHands();
        updateStrategyHighlight();
        setPhase('playing');
        return true;
    }
    return false;
}

// ─── Dealer Play ──────────────────────────────────────────
function revealDealerHole() {
    G.dealerHand[1].faceUp = true;
    G.seenCards.push(G.dealerHand[1]);
}

function dealerPlay() {
    setPhase('dealer');
    revealDealerHole();
    renderHands();

    const dealerStep = () => {
        const { total } = handTotal(G.dealerHand);
        if (total < 17) {
            G.dealerHand.push(dealCard());
            renderHands();
            renderDeckTracker();
            setTimeout(dealerStep, 500);
        } else {
            resolveAllHands();
        }
    };
    setTimeout(dealerStep, 600);
}

// ─── Resolve ──────────────────────────────────────────────
function resolveAllHands() {
    const { total: dealerTotal } = handTotal(G.dealerHand);
    const dealerBust = dealerTotal > 21;

    let overallResult = 'loss';
    G.playerHands.forEach((hand, idx) => {
        const { total: playerTotal } = handTotal(hand);
        const bet = G.handBets[idx];
        let result;

        if (isBust(hand)) {
            result = 'loss';
        } else if (dealerBust || playerTotal > dealerTotal) {
            result = 'win';
        } else if (playerTotal === dealerTotal) {
            result = 'push';
        } else {
            result = 'loss';
        }

        if (result === 'win') { G.balance += bet * 2; overallResult = 'win'; }
        else if (result === 'push') { G.balance += bet; overallResult = overallResult === 'win' ? 'win' : 'push'; }
        agentLog('info', `Hand ${idx + 1}: ${result}`, { playerTotal, dealerTotal, bet });
    });

    endHand(overallResult);
}

function endHand(result) {
    if (result === 'blackjack') {
        const payout = Math.floor(G.currentBet * 2.5);
        G.balance += payout;
        agentLog('info', 'Blackjack!', { payout, balance: G.balance });
    } else if (result === 'win') {
        agentLog('info', 'Win', { balance: G.balance });
    } else if (result === 'push') {
        agentLog('info', 'Push', { balance: G.balance });
    } else {
        agentLog('info', 'Loss', { balance: G.balance });
    }

    showResult(result);
    renderBalance();

    const lastHand = G.sessionHandHistory.at(-1);
    const basicAction = (() => {
        try {
            const ph = G.playerHands[0];
            const { total, isSoft } = handTotal(ph);
            const isPair = canSplit(ph);
            const pairRank = isPair ? ph[0].rank : null;
            const duc = G.dealerHand[0].rank;
            return getBasicStrategyAction(total, isSoft, isPair, pairRank, duc);
        } catch { return null; }
    })();
    const aiAction = lastHand?.steps?.[0]?.action?.toUpperCase()?.[0] || null;
    Analytics.recordHand(result, G.currentBet, G.balance, aiAction, basicAction);

    if (G.tournamentMode) {
        G.tournamentHandsLeft--;
        updateTournamentDisplay();
        if (G.tournamentHandsLeft <= 0) { endTournament(); return; }
    }

    if (G.voiceEnabled) speak(resultMessage(result));
    setTimeout(() => { G.currentBet = 0; setPhase('betting'); renderHands(); }, 1800);
}

function resultMessage(result) {
    return { win: 'You win!', loss: 'Dealer wins.', push: 'Push — tie.', blackjack: 'Blackjack! You win!' }[result] || '';
}

function showResult(result) {
    const msgs = { win: '✓ You Win!', loss: '✗ Dealer Wins', push: '↔ Push', blackjack: '★ Blackjack!' };
    const colors = { win: '#4caf50', loss: '#e53935', push: '#ffb300', blackjack: '#ffd700' };
    const el = document.getElementById('result-banner');
    el.textContent = msgs[result] || '';
    el.style.color = colors[result] || '#fff';
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 1600);
}

// ─── Strategy Highlight ───────────────────────────────────
function updateStrategyHighlight() {
    if (G.phase !== 'playing') return;
    const hand = G.playerHands[G.activeHandIdx];
    const { total, isSoft } = handTotal(hand);
    const isPair = canSplit(hand);
    const dealerUp = G.dealerHand[0].rank;
    renderStrategyMatrix(total, isSoft, dealerUp);
}

// ─── Post-Mortem ──────────────────────────────────────────
function renderPostMortem() {
    const el = document.getElementById('post-mortem');
    if (!el) return;
    const last = G.sessionHandHistory.at(-1);
    if (!last) return;
    el.innerHTML = `<h4>Last Hand Replay</h4>` +
        (last.steps.length === 0
            ? '<p>Blackjack — no decisions made.</p>'
            : last.steps.map((s, i) =>
                `<div class="replay-step">Step ${i + 1}: <strong>${s.action.toUpperCase()}</strong> with ${s.handBefore.join(' ')}</div>`
            ).join(''));
    el.style.display = 'block';
}

// ─── AI Agent ─────────────────────────────────────────────
async function getAIAdvice() {
    const hand = G.playerHands[G.activeHandIdx];
    const { total, isSoft } = handTotal(hand);
    const isPair = canSplit(hand);
    const pairRank = isPair ? hand[0].rank : null;
    const dealerUp = G.dealerHand[0].rank;

    const basicAction = getBasicStrategyAction(total, isSoft, isPair, pairRank, dealerUp);

    document.getElementById('get-advice-btn').disabled = true;
    document.getElementById('get-advice-btn').textContent = 'Thinking…';
    document.getElementById('recommended-action').textContent = '…';
    document.getElementById('ai-reasoning').textContent = '';

    const gameState = {
        playerHand: hand.map(c => c.rank + c.suit),
        playerTotal: total,
        isSoft,
        isPair,
        pairRank,
        dealerUpCard: dealerUp,
        balance: G.balance,
        bet: G.handBets[G.activeHandIdx] || G.currentBet,
        deckComposition: buildDeckComposition(),
        canDouble: canDouble(hand),
        canSplit: canSplit(hand),
    };

    try {
        const result = await queryAgent(gameState, G.explainDepth, G.playStyle, G.runningCount);
        G.pendingAction = result.action;

        const badge = document.getElementById('recommended-action');
        badge.textContent = result.action.toUpperCase();
        badge.className = 'action-badge action-' + result.action;

        document.getElementById('ai-reasoning').textContent = result.reasoning;
        document.getElementById('execute-btn').disabled = false;

        const matchesBasic = result.action[0].toUpperCase() === basicAction;
        document.getElementById('basic-strategy-note').textContent =
            `Basic strategy says: ${basicAction}${matchesBasic ? ' ✓ (AI agrees)' : ' ✗ (AI deviates)'}`;

        if (G.compareModel) runCompareModel(gameState, result.action);
        if (G.voiceEnabled) speak(`AI recommends ${result.action}. ${result.reasoning}`);
    } catch (err) {
        showToast(err.message, 'error');
        document.getElementById('recommended-action').textContent = 'Error';
        document.getElementById('ai-reasoning').textContent = err.message;
    } finally {
        document.getElementById('get-advice-btn').disabled = false;
        document.getElementById('get-advice-btn').textContent = 'Get AI Advice';
    }
}

async function runCompareModel(gameState, primaryAction) {
    const el = document.getElementById('compare-result');
    if (!el) return;
    el.textContent = `Querying ${G.compareModel}…`;
    try {
        const result = await queryAgent(gameState, G.explainDepth, G.playStyle, G.runningCount, G.compareModel);
        const agree = result.action === primaryAction;
        el.innerHTML = `<strong>${G.compareModel}:</strong> ${result.action.toUpperCase()} ${agree ? '✓ agrees' : '✗ differs'}<br><em>${result.reasoning}</em>`;
    } catch (err) {
        el.textContent = `Compare error: ${err.message}`;
    }
}

// ─── Deck Composition ────────────────────────────────────
function buildDeckComposition() {
    const counts = {};
    RANKS.forEach(r => counts[r] = 0);
    G.seenCards.forEach(c => counts[c.rank]++);
    const remaining = {};
    RANKS.forEach(r => {
        const total = r === '10' ? 16 : 4;
        remaining[r] = total - counts[r];
    });
    return remaining;
}

// ─── Scenario Sandbox ────────────────────────────────────
async function runSandbox() {
    const playerInput = document.getElementById('sandbox-player').value.trim().toUpperCase().split(/[\s,]+/);
    const dealerInput = document.getElementById('sandbox-dealer').value.trim().toUpperCase();
    if (!playerInput.length || !dealerInput) { showToast('Enter cards first.', 'warn'); return; }

    const fakeHand = playerInput.map(r => ({ rank: r, suit: '♠', value: cardValue(r), faceUp: true }));
    const { total, isSoft } = handTotal(fakeHand);
    const isPair = fakeHand.length === 2 && fakeHand[0].rank === fakeHand[1].rank;

    document.getElementById('sandbox-result').textContent = 'Querying AI…';
    try {
        const result = await queryAgent({
            playerHand: playerInput,
            playerTotal: total,
            isSoft,
            isPair,
            pairRank: isPair ? fakeHand[0].rank : null,
            dealerUpCard: dealerInput,
            balance: G.balance,
            bet: G.currentBet || 10,
            canDouble: true,
            canSplit: isPair,
        }, G.explainDepth, G.playStyle, G.runningCount);
        document.getElementById('sandbox-result').innerHTML =
            `<strong>AI: ${result.action.toUpperCase()}</strong><br>${result.reasoning}`;
    } catch (err) {
        document.getElementById('sandbox-result').textContent = err.message;
    }
}

// ─── Tournament ───────────────────────────────────────────
function startTournament() {
    const hands = parseInt(document.getElementById('tournament-hands').value) || 20;
    G.tournamentMode = true;
    G.tournamentHandsLeft = hands;
    G.tournamentHands = hands;
    G.tournamentStartBalance = G.balance;
    updateTournamentDisplay();
    showToast(`Tournament started: ${hands} hands.`, 'info');
}

function endTournament() {
    G.tournamentMode = false;
    const profit = G.balance - G.tournamentStartBalance;
    const sign = profit >= 0 ? '+' : '';
    showToast(`Tournament over! ${sign}$${profit} over ${G.tournamentHands} hands.`, 'info');
    document.getElementById('tournament-result').textContent =
        `Final: $${G.balance} (${sign}$${profit})`;
}

function updateTournamentDisplay() {
    const el = document.getElementById('tournament-status');
    if (el) el.textContent = G.tournamentMode
        ? `Tournament: ${G.tournamentHandsLeft} hands left`
        : '';
}

// ─── Voice ───────────────────────────────────────────────
function speak(text) {
    if (!G.voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
}

// ─── Theme ───────────────────────────────────────────────
function toggleTheme() {
    G.theme = G.theme === 'dark' ? 'light' : 'dark';
    document.body.classList.toggle('light-theme', G.theme === 'light');
    document.getElementById('theme-btn').textContent = G.theme === 'dark' ? '☀ Light' : '🌙 Dark';
}

// ─── Toast ───────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
}

// ─── Key Management ───────────────────────────────────────
const LS_KEY = 'bj_openai_key';

function applyKey(key) {
    key = (key || '').trim();
    if (!key) { showToast('Paste your OpenAI API key first.', 'warn'); return false; }
    G.apiKey = key;
    setApiKey(key);
    localStorage.setItem(LS_KEY, key);
    document.getElementById('api-status').textContent = 'Key loaded ✓ (' + key.slice(0, 8) + '••••' + key.slice(-4) + ')';
    document.getElementById('api-status').classList.add('loaded');
    document.getElementById('key-input').value = key;
    document.getElementById('deal-btn').disabled = G.currentBet === 0;
    agentLog('info', 'OpenAI key saved to localStorage');
    return true;
}

function clearKey() {
    G.apiKey = null;
    setApiKey(null);
    localStorage.removeItem(LS_KEY);
    document.getElementById('api-status').textContent = 'No key loaded';
    document.getElementById('api-status').classList.remove('loaded');
    document.getElementById('key-input').value = '';
    document.getElementById('deal-btn').disabled = true;
    showToast('Key cleared.', 'info');
}

// ─── UI Event Wiring ─────────────────────────────────────
function initUI() {
    // Key input — save button
    document.getElementById('key-save-btn').addEventListener('click', () => {
        const val = document.getElementById('key-input').value;
        if (applyKey(val)) showToast('Key saved ✓', 'info');
    });

    // Key input — press Enter to save
    document.getElementById('key-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            if (applyKey(e.target.value)) showToast('Key saved ✓', 'info');
        }
    });

    // Clear key
    document.getElementById('key-clear-btn').addEventListener('click', clearKey);

    // Load persisted key on startup
    const saved = localStorage.getItem(LS_KEY);
    if (saved) applyKey(saved);

    // Chips
    document.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => addBet(parseInt(btn.dataset.value)));
    });
    document.getElementById('clear-bet').addEventListener('click', clearBet);
    document.getElementById('deal-btn').addEventListener('click', deal);

    // AI
    document.getElementById('get-advice-btn').addEventListener('click', getAIAdvice);
    document.getElementById('execute-btn').addEventListener('click', () => {
        if (G.pendingAction) executeAction(G.pendingAction);
    });

    // Explainability
    document.querySelectorAll('.depth-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            G.explainDepth = btn.dataset.depth;
            document.querySelectorAll('.depth-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Play style
    document.getElementById('play-style').addEventListener('change', e => {
        G.playStyle = e.target.value;
        const countRow = document.getElementById('count-row');
        countRow.style.display = e.target.value === 'card-counter' ? 'flex' : 'none';
        renderBetSizeHint();
    });

    // Running count
    document.getElementById('running-count').addEventListener('input', e => {
        G.runningCount = e.target.value !== '' ? parseInt(e.target.value) : null;
        renderBetSizeHint();
    });

    // Compare model
    document.getElementById('compare-model').addEventListener('change', e => {
        G.compareModel = e.target.value || null;
    });

    // Console clear
    document.getElementById('clear-log').addEventListener('click', () => {
        document.getElementById('console-output').innerHTML = '';
    });

    // Export stats
    document.getElementById('export-stats').addEventListener('click', () => Analytics.exportStats(G.balance));

    // Theme
    document.getElementById('theme-btn').addEventListener('click', toggleTheme);

    // Voice
    document.getElementById('voice-btn').addEventListener('click', () => {
        G.voiceEnabled = !G.voiceEnabled;
        document.getElementById('voice-btn').textContent = G.voiceEnabled ? '🔊 Voice On' : '🔇 Voice Off';
        if (G.voiceEnabled) speak('Voice enabled.');
    });

    // Sandbox
    document.getElementById('sandbox-btn').addEventListener('click', runSandbox);

    // Tournament
    document.getElementById('tournament-start').addEventListener('click', startTournament);

    // Keyboard accessibility
    document.addEventListener('keydown', e => {
        if (G.phase !== 'playing') return;
        if (e.key === 'h' || e.key === 'H') { if (G.pendingAction === 'hit') executeAction('hit'); }
        if (e.key === 's' || e.key === 'S') { if (G.pendingAction === 'stand') executeAction('stand'); }
    });

    // Init game
    G.deck = shuffle(createDeck());
    Analytics.init(G.balance);
    setPhase('betting');
    renderBalance();
    agentLog('info', 'Blackjack AI Agent ready. Paste your OpenAI key above to begin.');
}

document.addEventListener('DOMContentLoaded', initUI);
