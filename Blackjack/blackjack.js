'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set(['♥', '♦']);

// ─── State ───────────────────────────────────────────────────────────────────
let state = {};

function initState(balance = 500) {
    state = {
        phase: 'BETTING',     // BETTING | PLAYING | DEALER_PLAYING | ROUND_COMPLETE
        deck: [],
        playerCards: [],
        dealerCards: [],
        balance,
        bet: 0,
        result: null,         // WIN | LOSE | PUSH | BLACKJACK | BUST
        holeRevealed: false,
        justRevealedHole: false,
        isFirstAction: true,
    };
    state.deck = buildShuffledDeck();
}

// ─── Deck ─────────────────────────────────────────────────────────────────────
function buildShuffledDeck() {
    const deck = [];
    for (const suit of SUITS)
        for (const rank of RANKS)
            deck.push({ rank, suit });
    return shuffle(deck);
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function drawCard() {
    if (state.deck.length < 10) state.deck = buildShuffledDeck();
    return state.deck.pop();
}

// ─── Hand Math ────────────────────────────────────────────────────────────────
function handValue(cards) {
    let total = 0, aces = 0;
    for (const { rank } of cards) {
        if (rank === 'A')          { aces++; total += 11; }
        else if ('JQK'.includes(rank)) total += 10;
        else                           total += parseInt(rank);
    }
    let softAces = aces;
    while (total > 21 && softAces > 0) { total -= 10; softAces--; }
    return { total, soft: softAces > 0 };
}

function isBust(cards)      { return handValue(cards).total > 21; }
function isBlackjack(cards) { return cards.length === 2 && handValue(cards).total === 21; }

function dealerShouldHit(cards) {
    const { total, soft } = handValue(cards);
    return total < 17 || (total === 17 && soft); // hit soft 17
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
    // HUD
    document.getElementById('hud-balance').textContent = `Balance: $${state.balance}`;
    document.getElementById('hud-bet').textContent     = `Bet: $${state.bet}`;

    // Player cards
    const playerContainer = document.getElementById('player-cards');
    playerContainer.innerHTML = '';
    state.playerCards.forEach((card, i) => {
        playerContainer.insertAdjacentHTML('beforeend', cardHTML(card, false, i * 0.1));
    });

    // Dealer cards
    const dealerContainer = document.getElementById('dealer-cards');
    dealerContainer.innerHTML = '';
    state.dealerCards.forEach((card, i) => {
        const faceDown  = i === 1 && !state.holeRevealed;
        const revealing = i === 1 && state.justRevealedHole;
        dealerContainer.insertAdjacentHTML('beforeend', cardHTML(card, faceDown, i * 0.1, revealing));
    });
    state.justRevealedHole = false;

    // Score badges
    const { total: pTotal } = handValue(state.playerCards);
    document.getElementById('player-score').textContent =
        state.playerCards.length ? pTotal : '';

    if (state.dealerCards.length) {
        if (state.holeRevealed) {
            const { total: dTotal } = handValue(state.dealerCards);
            document.getElementById('dealer-score').textContent = dTotal;
        } else {
            const { total: dVisible } = handValue([state.dealerCards[0]]);
            document.getElementById('dealer-score').textContent = `${dVisible} + ?`;
        }
    } else {
        document.getElementById('dealer-score').textContent = '';
    }

    // Status message
    const msgEl = document.getElementById('status-message');
    msgEl.className = 'status-message';
    msgEl.textContent = '';
    if (state.result) {
        const labels = { WIN: 'WIN!', LOSE: 'LOSE', PUSH: 'PUSH', BLACKJACK: 'BLACKJACK!', BUST: 'BUST' };
        msgEl.textContent = labels[state.result];
        msgEl.classList.add(state.result.toLowerCase());
    }

    // Zone effects
    const playerZone = document.getElementById('player-zone');
    playerZone.classList.remove('win-glow', 'shake');
    if (state.result === 'WIN' || state.result === 'BLACKJACK') {
        void playerZone.offsetWidth; // reflow to retrigger
        playerZone.classList.add('win-glow');
    } else if (state.result === 'BUST' || state.result === 'LOSE') {
        void playerZone.offsetWidth;
        playerZone.classList.add('shake');
    }

    // Control panels
    const isBetting  = state.phase === 'BETTING';
    const isPlaying  = state.phase === 'PLAYING';
    const isComplete = state.phase === 'ROUND_COMPLETE';
    const isGameOver = isComplete && state.balance <= 0;

    document.getElementById('betting-controls').classList.toggle('hidden', !isBetting);
    document.getElementById('action-controls').classList.toggle('hidden', !isPlaying);
    document.getElementById('new-round-controls').classList.toggle('hidden', !isComplete || isGameOver);
    document.getElementById('game-over-controls').classList.toggle('hidden', !isGameOver);

    if (isBetting) {
        document.getElementById('deal-btn').disabled =
            state.bet === 0 || state.bet > state.balance;
    }

    if (isPlaying) {
        document.getElementById('hit-btn').disabled    = false;
        document.getElementById('stand-btn').disabled  = false;
        document.getElementById('double-btn').disabled =
            !state.isFirstAction || state.balance < state.bet;
    }
}

function cardHTML(card, faceDown, delay = 0, revealing = false) {
    if (faceDown) {
        return `<div class="card card-back" style="animation-delay:${delay}s"></div>`;
    }
    const color    = RED_SUITS.has(card.suit) ? 'red' : 'black';
    const revClass = revealing ? ' revealing' : '';
    return `
        <div class="card ${color}${revClass}" style="animation-delay:${delay}s">
            <div class="card-corner top-left">
                <div class="card-rank">${card.rank}</div>
                <div class="card-suit-small">${card.suit}</div>
            </div>
            <div class="card-center">${card.suit}</div>
            <div class="card-corner bottom-right">
                <div class="card-rank">${card.rank}</div>
                <div class="card-suit-small">${card.suit}</div>
            </div>
        </div>`;
}

// ─── Betting ──────────────────────────────────────────────────────────────────
function placeBet(amount) {
    if (state.phase !== 'BETTING') return;
    state.bet = Math.min(state.bet + amount, state.balance);
    render();
}

function clearBet() {
    if (state.phase !== 'BETTING') return;
    state.bet = 0;
    render();
}

// ─── Round Start ──────────────────────────────────────────────────────────────
function startRound() {
    if (state.bet === 0 || state.bet > state.balance) return;
    state.balance    -= state.bet;
    state.playerCards = [drawCard(), drawCard()];
    state.dealerCards = [drawCard(), drawCard()];
    state.phase        = 'PLAYING';
    state.holeRevealed = false;
    state.isFirstAction = true;
    state.result       = null;
    render();

    // Natural blackjack check
    const playerBJ = isBlackjack(state.playerCards);
    const dealerBJ = isBlackjack(state.dealerCards);
    if (playerBJ || dealerBJ) {
        state.holeRevealed      = true;
        state.justRevealedHole  = true;
        if (playerBJ && dealerBJ)      resolveRound('PUSH');
        else if (playerBJ)             resolveRound('BLACKJACK');
        else                           resolveRound('LOSE');
    }
}

// ─── Player Actions ───────────────────────────────────────────────────────────
function playerHit() {
    if (state.phase !== 'PLAYING') return;
    hideHint();
    state.isFirstAction = false;
    state.playerCards.push(drawCard());
    render();
    const { total } = handValue(state.playerCards);
    if (isBust(state.playerCards)) resolveRound('BUST');
    else if (total === 21)         playerStand();
}

function playerStand() {
    if (state.phase !== 'PLAYING') return;
    hideHint();
    state.phase            = 'DEALER_PLAYING';
    state.holeRevealed     = true;
    state.justRevealedHole = true;
    render();
    setTimeout(dealerPlay, 550);
}

function playerDouble() {
    if (state.phase !== 'PLAYING' || !state.isFirstAction) return;
    if (state.balance < state.bet) return;
    hideHint();
    state.balance       -= state.bet;
    state.bet           *= 2;
    state.isFirstAction  = false;
    state.playerCards.push(drawCard());
    render();
    if (isBust(state.playerCards)) resolveRound('BUST');
    else                           playerStand();
}

// ─── Dealer Play ──────────────────────────────────────────────────────────────
function dealerPlay() {
    if (dealerShouldHit(state.dealerCards)) {
        state.dealerCards.push(drawCard());
        render();
        setTimeout(dealerPlay, 620);
    } else {
        const pv = handValue(state.playerCards).total;
        const dv = handValue(state.dealerCards).total;
        if (isBust(state.dealerCards))  resolveRound('WIN');
        else if (pv > dv)               resolveRound('WIN');
        else if (pv < dv)               resolveRound('LOSE');
        else                            resolveRound('PUSH');
    }
}

// ─── Resolve ──────────────────────────────────────────────────────────────────
function resolveRound(result) {
    state.result = result;
    state.phase  = 'ROUND_COMPLETE';
    switch (result) {
        case 'WIN':       state.balance += state.bet * 2;                   break;
        case 'BLACKJACK': state.balance += Math.floor(state.bet * 2.5);     break;
        case 'PUSH':      state.balance += state.bet;                       break;
        // LOSE / BUST: bet already deducted at startRound
    }
    render();
    if (result === 'WIN' || result === 'BLACKJACK') spawnParticles();
}

// ─── New Round ────────────────────────────────────────────────────────────────
function newRound() {
    state.phase            = 'BETTING';
    state.playerCards      = [];
    state.dealerCards      = [];
    state.bet              = 0;
    state.result           = null;
    state.holeRevealed     = false;
    state.justRevealedHole = false;
    state.isFirstAction    = true;
    render();
}

function restartGame() {
    initState(1000);
    render();
}

// ─── Hint ─────────────────────────────────────────────────────────────────────
let hintTimeout = null;

function showHint() {
    const { total, soft } = handValue(state.playerCards);
    const dealerUpcard    = state.dealerCards[0];
    const hint = basicStrategy(total, soft, state.playerCards.length, dealerUpcard);
    const hintEl = document.getElementById('hint-text');
    hintEl.textContent = `Basic strategy: ${hint}`;
    hintEl.classList.remove('hidden');
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(hideHint, 3000);
}

function hideHint() {
    clearTimeout(hintTimeout);
    const hintEl = document.getElementById('hint-text');
    if (hintEl) hintEl.classList.add('hidden');
}

function basicStrategy(total, soft, numCards, dealerCard) {
    const d = dealerCard.rank === 'A' ? 11
        : 'JQK'.includes(dealerCard.rank) ? 10
        : parseInt(dealerCard.rank);
    const canDouble = numCards === 2;

    if (soft) {
        if (total >= 19) return 'Stand';
        if (total === 18) {
            if (d >= 2 && d <= 6) return canDouble ? 'Double Down' : 'Stand';
            if (d <= 8)           return 'Stand';
            return 'Hit';
        }
        if (total === 17) return (d >= 3 && d <= 6 && canDouble) ? 'Double Down' : 'Hit';
        if (total === 15 || total === 16) return (d >= 4 && d <= 6 && canDouble) ? 'Double Down' : 'Hit';
        if (total === 13 || total === 14) return (d >= 5 && d <= 6 && canDouble) ? 'Double Down' : 'Hit';
        return 'Hit';
    }

    // Hard totals
    if (total >= 17) return 'Stand';
    if (total >= 13) return d <= 6 ? 'Stand' : 'Hit';
    if (total === 12) return (d >= 4 && d <= 6) ? 'Stand' : 'Hit';
    if (total === 11) return (d !== 11 && canDouble) ? 'Double Down' : 'Hit';
    if (total === 10) return (d <= 9  && canDouble) ? 'Double Down' : 'Hit';
    if (total === 9)  return (d >= 3 && d <= 6 && canDouble) ? 'Double Down' : 'Hit';
    return 'Hit';
}

// ─── Particles ────────────────────────────────────────────────────────────────
function spawnParticles() {
    const zone  = document.getElementById('player-zone');
    const count = state.result === 'BLACKJACK' ? 42 : 26;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left             = (8 + Math.random() * 84) + '%';
        p.style.top              = (10 + Math.random() * 78) + '%';
        p.style.animationDelay   = (Math.random() * 0.5) + 's';
        p.style.animationDuration = (0.8 + Math.random() * 0.7) + 's';
        p.style.background       = Math.random() > 0.45 ? '#ffd700' : '#e8c96e';
        p.style.width            = (5 + Math.random() * 5) + 'px';
        p.style.height           = p.style.width;
        zone.appendChild(p);
        setTimeout(() => p.remove(), 1600);
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
initState();
render();
