'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set(['♥', '♦']);

// ─── DOM Cache ────────────────────────────────────────────────────────────────
const el = {};

function cacheElements() {
    el.hudBalance    = document.getElementById('hud-balance');
    el.hudBet        = document.getElementById('hud-bet');
    el.shoeCount     = document.getElementById('shoe-count');
    el.shoeBar       = document.getElementById('shoe-bar');
    el.countPanel    = document.getElementById('count-panel');
    el.countRunning  = document.getElementById('count-running');
    el.countTrue     = document.getElementById('count-true');
    el.betCenter     = document.getElementById('bet-center');
    el.dealerCards   = document.getElementById('dealer-cards');
    el.playerCards   = document.getElementById('player-cards');
    el.dealerScore   = document.getElementById('dealer-score');
    el.playerScore   = document.getElementById('player-score');
    el.statusMsg     = document.getElementById('status-message');
    el.playerZone    = document.getElementById('player-zone');
    el.bettingCtrl   = document.getElementById('betting-controls');
    el.actionCtrl    = document.getElementById('action-controls');
    el.newRoundCtrl  = document.getElementById('new-round-controls');
    el.gameOverCtrl  = document.getElementById('game-over-controls');
    el.dealBtn       = document.getElementById('deal-btn');
    el.hitBtn        = document.getElementById('hit-btn');
    el.standBtn      = document.getElementById('stand-btn');
    el.doubleBtn     = document.getElementById('double-btn');
    el.hintText      = document.getElementById('hint-text');
    el.insuranceCtrl = document.getElementById('insurance-controls');
    el.insAmount     = document.getElementById('ins-amount');
    el.splitBtn      = document.getElementById('split-btn');
    el.tellHint      = document.getElementById('tell-hint');
    el.tellText      = document.getElementById('tell-text');
    el.splitHands    = document.getElementById('split-hands');
    el.splitHand     = [document.getElementById('split-hand-0'), document.getElementById('split-hand-1')];
    el.splitCards    = [document.getElementById('split-cards-0'), document.getElementById('split-cards-1')];
    el.splitScore    = [document.getElementById('split-score-0'), document.getElementById('split-score-1')];
}

// ─── State ───────────────────────────────────────────────────────────────────
let state = {};
let countVisible = false;

function initState(balance = 500) {
    state = {
        phase: 'BETTING',
        deck: [],
        playerCards: [],
        dealerCards: [],
        balance,
        bet: 0,
        result: null,
        holeRevealed: false,
        isFirstAction: true,
        runningCount: 0,
        insuranceBet: 0,
        isSplit: false,
        splitHands: [[], []],
        activeHand: 0,
        splitResults: [null, null],
    };
    state.deck = buildShuffledDeck();
    // shoe display updated after cacheElements runs
}

// ─── Deck ─────────────────────────────────────────────────────────────────────
const SHOE_SIZE = 6;
const SHOE_TOTAL = SHOE_SIZE * 52;

function buildShuffledDeck() {
    const deck = [];
    for (let d = 0; d < SHOE_SIZE; d++)
        for (const suit of SUITS)
            for (const rank of RANKS)
                deck.push({ rank, suit });
    return shuffle(deck);
}

function updateShoeDisplay() {
    const remaining = state.deck.length;
    el.shoeCount.textContent = remaining;
    el.shoeBar.style.width = (remaining / SHOE_TOTAL * 100) + '%';
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function drawCard() {
    if (state.deck.length < 52) {
        state.deck = buildShuffledDeck();
        state.runningCount = 0;
        if (el.countRunning) updateCountDisplay();
    }
    const card = state.deck.pop();
    updateShoeDisplay();
    return card;
}

// ─── Hi-Lo Count ──────────────────────────────────────────────────────────────
function hiLoValue(rank) {
    if ('23456'.includes(rank)) return +1;
    if ('789'.includes(rank))   return  0;
    return -1; // 10, J, Q, K, A
}

function countCard(card) {
    state.runningCount += hiLoValue(card.rank);
    updateCountDisplay();
}

function updateCountDisplay() {
    const decksLeft = Math.max(state.deck.length / 52, 0.5);
    const trueCount = (state.runningCount / decksLeft).toFixed(1);
    const sign = state.runningCount > 0 ? '+' : '';
    el.countRunning.textContent = `Running: ${sign}${state.runningCount}`;
    el.countTrue.textContent    = `True: ${trueCount}`;
}

function toggleCount() {
    countVisible = !countVisible;
    el.countPanel.classList.toggle('hidden', !countVisible);
}

// ─── Hand Math ────────────────────────────────────────────────────────────────
function handValue(cards) {
    let total = 0, aces = 0;
    for (const { rank } of cards) {
        if (rank === 'A')              { aces++; total += 11; }
        else if ('JQK'.includes(rank)) total += 10;
        else                           total += parseInt(rank);
    }
    let softAces = aces;
    while (total > 21 && softAces > 0) { total -= 10; softAces--; }
    return { total, soft: softAces > 0 };
}

function isBust(cards)      { return handValue(cards).total > 21; }
function isBlackjack(cards) { return cards.length === 2 && handValue(cards).total === 21; }
function cardValue(card)    { return 'JQK'.includes(card.rank) ? 10 : card.rank === 'A' ? 11 : parseInt(card.rank); }

function dealerShouldHit(cards) {
    const { total, soft } = handValue(cards);
    return total < 17 || (total === 17 && soft);
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────
function htmlToElement(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
}

function cardHTML(card, faceDown, delay = 0, revealing = false) {
    if (faceDown) {
        return `<div class="card card-back" style="animation-delay:${delay}s"></div>`;
    }
    const color    = RED_SUITS.has(card.suit) ? 'red' : 'black';
    const revClass = revealing ? ' revealing' : '';
    return `<div class="card ${color}${revClass}" style="animation-delay:${delay}s">` +
        `<div class="card-corner top-left"><div class="card-rank">${card.rank}</div><div class="card-suit-small">${card.suit}</div></div>` +
        `<div class="card-center">${card.suit}</div>` +
        `<div class="card-corner bottom-right"><div class="card-rank">${card.rank}</div><div class="card-suit-small">${card.suit}</div></div>` +
        `</div>`;
}

function appendCard(container, card, faceDown, delay = 0) {
    container.insertAdjacentHTML('beforeend', cardHTML(card, faceDown, delay));
}

// ─── Targeted Update Functions ────────────────────────────────────────────────

// Called only when bet changes — never touches cards
function updateBetDisplay() {
    el.hudBet.textContent    = `Bet: $${state.bet}`;
    el.dealBtn.disabled      = state.bet === 0 || state.bet > state.balance;

    if (state.bet > 0) {
        el.betCenter.textContent = `$${state.bet}`;
        el.betCenter.classList.remove('hidden');
        el.betCenter.classList.remove('pop');
        void el.betCenter.offsetWidth;      // restart animation
        el.betCenter.classList.add('pop');
    } else {
        el.betCenter.textContent = '';
        el.betCenter.classList.add('hidden');
    }
}

function updatePlayerScore() {
    const { total } = handValue(state.playerCards);
    el.playerScore.textContent = state.playerCards.length ? total : '';
}

function updateDealerScore() {
    if (!state.dealerCards.length) { el.dealerScore.textContent = ''; return; }
    if (state.holeRevealed) {
        el.dealerScore.textContent = handValue(state.dealerCards).total;
    } else {
        el.dealerScore.textContent = `${handValue([state.dealerCards[0]]).total} + ?`;
    }
}

function updateHUDBalance() {
    el.hudBalance.textContent = `Balance: $${state.balance}`;
}

function updateResult() {
    el.statusMsg.className   = 'status-message';
    el.statusMsg.textContent = '';
    el.playerZone.classList.remove('win-glow', 'shake');

    if (!state.result) return;

    const labels = { WIN: 'WIN!', LOSE: 'LOSE', PUSH: 'PUSH', BLACKJACK: 'BLACKJACK!', BUST: 'BUST' };
    el.statusMsg.textContent = labels[state.result];
    el.statusMsg.classList.add(state.result.toLowerCase());

    if (state.result === 'WIN' || state.result === 'BLACKJACK') {
        el.playerZone.classList.add('win-glow');
    } else if (state.result === 'BUST' || state.result === 'LOSE') {
        el.playerZone.classList.add('shake');
    }
}

function updatePhaseUI() {
    const isBetting   = state.phase === 'BETTING';
    const isInsurance = state.phase === 'INSURANCE';
    const isPlaying   = state.phase === 'PLAYING';
    const isComplete  = state.phase === 'ROUND_COMPLETE';
    const isGameOver  = isComplete && state.balance <= 0;

    el.bettingCtrl.classList.toggle('hidden', !isBetting);
    el.insuranceCtrl.classList.toggle('hidden', !isInsurance);
    el.actionCtrl.classList.toggle('hidden', !isPlaying);
    el.newRoundCtrl.classList.toggle('hidden', !isComplete || isGameOver);
    el.gameOverCtrl.classList.toggle('hidden', !isGameOver);

    if (isPlaying) {
        const isAceSplit = state.isSplit && state.splitHands[0][0]?.rank === 'A';
        el.hitBtn.disabled    = isAceSplit; // no hit on split aces
        el.standBtn.disabled  = false;
        el.doubleBtn.disabled = !state.isFirstAction || state.balance < state.bet || state.isSplit;
        // Split: available on first action, matching card values, enough balance
        const canSplit = state.isFirstAction && !state.isSplit &&
            cardValue(state.playerCards[0]) === cardValue(state.playerCards[1]) &&
            state.balance >= state.bet;
        el.splitBtn.classList.toggle('hidden', !canSplit);
    }
}

function clearTable() {
    el.playerCards.innerHTML = '';
    el.dealerCards.innerHTML = '';
    el.playerScore.textContent = '';
    el.dealerScore.textContent = '';
    el.betCenter.classList.add('hidden');
    el.statusMsg.className   = 'status-message';
    el.statusMsg.textContent = '';
    el.playerZone.classList.remove('win-glow', 'shake');
    // Reset split UI
    el.splitHands.classList.add('hidden');
    el.playerCards.classList.remove('hidden');
    el.splitCards[0].innerHTML = '';
    el.splitCards[1].innerHTML = '';
    el.splitScore[0].textContent = '';
    el.splitScore[1].textContent = '';
    el.splitHand[0].classList.remove('active-hand');
    el.splitHand[1].classList.remove('active-hand');
}

function revealHoleCard(animated = true) {
    state.holeRevealed = true;
    clearTell();
    const holeEl = el.dealerCards.children[1];
    if (!holeEl) return;
    const newCard = htmlToElement(cardHTML(state.dealerCards[1], false, 0, animated));
    el.dealerCards.replaceChild(newCard, holeEl);
    countCard(state.dealerCards[1]);
    updateDealerScore();
}

// ─── Dealer Tell ──────────────────────────────────────────────────────────────
function applyDealerTell(holeCard) {
    const isHighCard = 'JQK10A'.includes(holeCard.rank) || holeCard.rank === '10';
    const isLowCard  = '23456'.includes(holeCard.rank);
    const holeEl     = el.dealerCards.children[1];
    if (!holeEl) return;

    if (isHighCard && Math.random() < 0.6) {
        holeEl.classList.add('tell-twitch');
        el.tellText.textContent = 'The dealer seems a little tense…';
        el.tellHint.classList.remove('hidden');
    } else if (isLowCard && Math.random() < 0.5) {
        holeEl.classList.add('tell-calm');
        el.tellText.textContent = 'The dealer looks surprisingly relaxed…';
        el.tellHint.classList.remove('hidden');
    }
}

function clearTell() {
    el.tellHint.classList.add('hidden');
    const holeEl = el.dealerCards.children[1];
    if (holeEl) { holeEl.classList.remove('tell-twitch', 'tell-calm'); }
}

// ─── Betting ──────────────────────────────────────────────────────────────────
function placeBet(amount) {
    if (state.phase !== 'BETTING') return;
    state.bet = Math.min(state.bet + amount, state.balance);
    updateBetDisplay();         // ← only updates bet UI, never touches cards
}

function clearBet() {
    if (state.phase !== 'BETTING') return;
    state.bet = 0;
    updateBetDisplay();
}

// ─── Round Start ──────────────────────────────────────────────────────────────
function startRound() {
    if (state.bet === 0 || state.bet > state.balance) return;
    state.balance     -= state.bet;
    state.playerCards  = [drawCard(), drawCard()];
    state.dealerCards  = [drawCard(), drawCard()];
    state.phase        = 'PLAYING';
    state.holeRevealed = false;
    state.isFirstAction = true;
    state.result       = null;
    state.isSplit      = false;
    state.splitHands   = [[], []];
    state.activeHand   = 0;
    state.splitResults = [null, null];
    state.insuranceBet = 0;

    clearTable();
    updateHUDBalance();

    // Deal 4 cards with staggered animation
    appendCard(el.playerCards, state.playerCards[0], false, 0);    countCard(state.playerCards[0]);
    appendCard(el.dealerCards, state.dealerCards[0], false, 0.12); countCard(state.dealerCards[0]);
    appendCard(el.playerCards, state.playerCards[1], false, 0.24); countCard(state.playerCards[1]);
    appendCard(el.dealerCards, state.dealerCards[1], true,  0.36); // hole card — counted on reveal
    setTimeout(() => applyDealerTell(state.dealerCards[1]), 600);

    updatePlayerScore();
    updateDealerScore();
    updatePhaseUI();

    // Check for insurance offer (dealer upcard is Ace)
    const dealerUpcard = state.dealerCards[0];
    if (dealerUpcard.rank === 'A') {
        state.phase = 'INSURANCE';
        el.insAmount.textContent = Math.floor(state.bet / 2);
        updatePhaseUI();
        return;
    }

    // Natural blackjack check (no insurance offered)
    checkNaturalBlackjack();
}

function checkNaturalBlackjack() {
    const playerBJ = isBlackjack(state.playerCards);
    const dealerBJ = isBlackjack(state.dealerCards);
    if (playerBJ || dealerBJ) {
        revealHoleCard(false);
        if (playerBJ && dealerBJ) resolveRound('PUSH');
        else if (playerBJ)        resolveRound('BLACKJACK');
        else                      resolveRound('LOSE');
    }
}

function takeInsurance() {
    const insBet = Math.floor(state.bet / 2);
    state.insuranceBet = insBet;
    state.balance -= insBet;
    updateHUDBalance();
    resolveInsurance();
}

function declineInsurance() {
    state.insuranceBet = 0;
    resolveInsurance();
}

function resolveInsurance() {
    const dealerBJ = isBlackjack(state.dealerCards);
    if (dealerBJ) {
        // Insurance pays 2:1; original bet is lost (already deducted)
        state.balance += state.insuranceBet * 3; // return stake + 2:1 payout
        updateHUDBalance();
        revealHoleCard(false);
        // Player also had their bet taken; push if player has BJ too
        if (isBlackjack(state.playerCards)) resolveRound('PUSH');
        else resolveRound('LOSE');
    } else {
        // Insurance lost (if taken); insurance bet already deducted, do nothing extra
        state.phase = 'PLAYING';
        updatePhaseUI();
        checkNaturalBlackjack();
    }
}

// ─── Player Actions ───────────────────────────────────────────────────────────
function playerHit() {
    if (state.phase !== 'PLAYING') return;
    hideHint();
    state.isFirstAction = false;
    const card = drawCard();
    countCard(card);

    if (state.isSplit) {
        const h = state.activeHand;
        state.splitHands[h].push(card);
        appendCard(el.splitCards[h], card, false, 0);
        updateSplitScore(h);
        el.doubleBtn.disabled = true;
        if (isBust(state.splitHands[h])) advanceSplitHand();
        else if (handValue(state.splitHands[h]).total === 21) advanceSplitHand();
    } else {
        state.playerCards.push(card);
        appendCard(el.playerCards, card, false, 0);
        updatePlayerScore();
        el.doubleBtn.disabled = true;
        if (isBust(state.playerCards))                      resolveRound('BUST');
        else if (handValue(state.playerCards).total === 21) playerStand();
    }
}

function playerStand() {
    if (state.phase !== 'PLAYING') return;
    hideHint();
    if (state.isSplit) { advanceSplitHand(); return; }
    state.phase = 'DEALER_PLAYING';
    revealHoleCard(true);
    updatePhaseUI();
    setTimeout(dealerPlay, 550);
}

function playerSplit() {
    if (!state.isFirstAction || state.isSplit || state.balance < state.bet) return;
    hideHint();
    state.balance -= state.bet;   // second bet
    updateHUDBalance();
    state.isSplit      = true;
    state.activeHand   = 0;
    state.splitResults = [null, null];
    // Move original cards into split hands
    state.splitHands = [[state.playerCards[0]], [state.playerCards[1]]];
    state.playerCards = [];
    // Deal one card to each split hand
    const c0 = drawCard(); countCard(c0); state.splitHands[0].push(c0);
    const c1 = drawCard(); countCard(c1); state.splitHands[1].push(c1);
    // Switch UI to split layout
    el.playerCards.classList.add('hidden');
    el.splitHands.classList.remove('hidden');
    // Render cards
    el.splitCards[0].innerHTML = '';
    el.splitCards[1].innerHTML = '';
    appendCard(el.splitCards[0], state.splitHands[0][0], false, 0);
    appendCard(el.splitCards[0], state.splitHands[0][1], false, 0.12);
    appendCard(el.splitCards[1], state.splitHands[1][0], false, 0.24);
    appendCard(el.splitCards[1], state.splitHands[1][1], false, 0.36);
    updateSplitScore(0); updateSplitScore(1);
    el.splitHand[0].classList.add('active-hand');
    el.splitHand[1].classList.remove('active-hand');
    state.isFirstAction = false;
    updatePhaseUI();
    // Auto-stand split aces (one card each, already dealt)
    if (state.splitHands[0][0].rank === 'A') {
        setTimeout(() => advanceSplitHand(), 400);
    }
}

function updateSplitScore(h) {
    const { total } = handValue(state.splitHands[h]);
    el.splitScore[h].textContent = total;
}

function advanceSplitHand() {
    if (state.activeHand === 0) {
        state.activeHand = 1;
        el.splitHand[0].classList.remove('active-hand');
        el.splitHand[1].classList.add('active-hand');
        state.isFirstAction = true;
        updatePhaseUI();
        // Auto-stand split aces
        if (state.splitHands[0][0].rank === 'A') {
            setTimeout(() => advanceSplitHand(), 400);
        }
    } else {
        // Both hands done — run dealer
        state.phase = 'DEALER_PLAYING';
        el.splitHand[1].classList.remove('active-hand');
        revealHoleCard(true);
        updatePhaseUI();
        setTimeout(dealerPlaySplit, 550);
    }
}

function dealerPlaySplit() {
    if (dealerShouldHit(state.dealerCards)) {
        const card = drawCard();
        state.dealerCards.push(card);
        appendCard(el.dealerCards, card, false, 0);
        countCard(card);
        updateDealerScore();
        setTimeout(dealerPlaySplit, 600);
    } else {
        resolveSplitRound();
    }
}

function resolveSplitRound() {
    const dv = handValue(state.dealerCards).total;
    const dealerBust = isBust(state.dealerCards);
    let netChange = 0;
    const resultLabels = [];

    for (let h = 0; h < 2; h++) {
        const pv = handValue(state.splitHands[h]).total;
        const bust = isBust(state.splitHands[h]);
        let res;
        if (bust)              res = 'BUST';
        else if (dealerBust)   res = 'WIN';
        else if (pv > dv)      res = 'WIN';
        else if (pv < dv)      res = 'LOSE';
        else                   res = 'PUSH';
        state.splitResults[h] = res;
        if (res === 'WIN')   netChange += state.bet;
        if (res === 'PUSH')  netChange += 0;
        if (res === 'BUST' || res === 'LOSE') netChange -= 0; // already deducted
        // Adjust balance
        if (res === 'WIN')  state.balance += state.bet * 2;
        if (res === 'PUSH') state.balance += state.bet;
        resultLabels.push(`H${h+1}: ${res}`);
    }

    state.result = state.splitResults.every(r => r === 'WIN') ? 'WIN'
        : state.splitResults.every(r => r === 'BUST' || r === 'LOSE') ? 'LOSE'
        : 'PUSH';
    state.phase = 'ROUND_COMPLETE';
    updateHUDBalance();

    // Show per-hand results in status
    el.statusMsg.className = 'status-message';
    el.statusMsg.textContent = resultLabels.join('  ·  ');
    const anyWin = state.splitResults.some(r => r === 'WIN');
    if (anyWin) {
        el.statusMsg.classList.add('win');
        el.playerZone.classList.add('win-glow');
        spawnParticles();
    } else if (state.splitResults.every(r => r === 'BUST' || r === 'LOSE')) {
        el.statusMsg.classList.add('lose');
        el.playerZone.classList.add('shake');
    } else {
        el.statusMsg.classList.add('push');
    }
    updatePhaseUI();
    const isGameOver = state.balance <= 0;
    el.newRoundCtrl.classList.toggle('hidden', isGameOver);
    el.gameOverCtrl.classList.toggle('hidden', !isGameOver);
}

function playerDouble() {
    if (state.phase !== 'PLAYING' || !state.isFirstAction) return;
    if (state.balance < state.bet) return;
    hideHint();
    state.balance      -= state.bet;
    state.bet          *= 2;
    state.isFirstAction = false;
    el.hudBet.textContent = `Bet: $${state.bet}`;
    updateHUDBalance();

    const card = drawCard();
    state.playerCards.push(card);
    appendCard(el.playerCards, card, false, 0);
    updatePlayerScore();

    if (isBust(state.playerCards)) resolveRound('BUST');
    else                           playerStand();
}

// ─── Dealer Play ──────────────────────────────────────────────────────────────
function dealerPlay() {
    if (dealerShouldHit(state.dealerCards)) {
        const card = drawCard();
        state.dealerCards.push(card);
        appendCard(el.dealerCards, card, false, 0);
        countCard(card);
        updateDealerScore();
        setTimeout(dealerPlay, 600);
    } else {
        const pv = handValue(state.playerCards).total;
        const dv = handValue(state.dealerCards).total;
        if (isBust(state.dealerCards)) resolveRound('WIN');
        else if (pv > dv)              resolveRound('WIN');
        else if (pv < dv)              resolveRound('LOSE');
        else                           resolveRound('PUSH');
    }
}

// ─── Resolve ──────────────────────────────────────────────────────────────────
function resolveRound(result) {
    state.result = result;
    state.phase  = 'ROUND_COMPLETE';
    switch (result) {
        case 'WIN':       state.balance += state.bet * 2;               break;
        case 'BLACKJACK': state.balance += Math.floor(state.bet * 2.5); break;
        case 'PUSH':      state.balance += state.bet;                   break;
    }
    updateHUDBalance();
    updateResult();
    updatePhaseUI();
    if (result === 'WIN' || result === 'BLACKJACK') spawnParticles();
}

// ─── New Round ────────────────────────────────────────────────────────────────
function newRound() {
    state.phase         = 'BETTING';
    state.playerCards   = [];
    state.dealerCards   = [];
    state.bet           = 0;
    state.result        = null;
    state.holeRevealed  = false;
    state.isFirstAction = true;
    state.isSplit       = false;
    state.splitHands    = [[], []];
    state.activeHand    = 0;
    state.splitResults  = [null, null];
    state.insuranceBet  = 0;

    clearTable();
    updateBetDisplay();
    updatePhaseUI();
}

function restartGame() {
    initState(1000);
    clearTable();
    updateHUDBalance();
    updateBetDisplay();
    updatePhaseUI();
}

// ─── Hint ─────────────────────────────────────────────────────────────────────
let hintTimeout = null;

function showHint() {
    const { total, soft } = handValue(state.playerCards);
    const hint = basicStrategy(total, soft, state.playerCards.length, state.dealerCards[0]);
    el.hintText.textContent = `Basic strategy: ${hint}`;
    el.hintText.classList.remove('hidden');
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(hideHint, 3000);
}

function hideHint() {
    clearTimeout(hintTimeout);
    el.hintText.classList.add('hidden');
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
    const zone  = el.playerZone;
    const count = state.result === 'BLACKJACK' ? 40 : 24;
    const frag  = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.cssText = `left:${8 + Math.random() * 84}%;top:${10 + Math.random() * 78}%;` +
            `animation-delay:${(Math.random() * 0.45).toFixed(2)}s;` +
            `animation-duration:${(0.8 + Math.random() * 0.65).toFixed(2)}s;` +
            `background:${Math.random() > 0.45 ? '#ffd700' : '#e8c96e'};` +
            `width:${(5 + Math.random() * 5).toFixed(1)}px;` +
            `height:${(5 + Math.random() * 5).toFixed(1)}px;`;
        frag.appendChild(p);
        setTimeout(() => p.remove(), 1500);
    }
    zone.appendChild(frag);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
cacheElements();
initState();
updateShoeDisplay();
// Set initial UI state without touching cards
el.hudBalance.textContent = `Balance: $${state.balance}`;
el.hudBet.textContent     = `Bet: $${state.bet}`;
el.bettingCtrl.classList.remove('hidden');
el.insuranceCtrl.classList.add('hidden');
el.actionCtrl.classList.add('hidden');
el.newRoundCtrl.classList.add('hidden');
el.gameOverCtrl.classList.add('hidden');
el.dealBtn.disabled = true;
