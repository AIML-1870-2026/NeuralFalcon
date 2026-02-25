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
}

// ─── State ───────────────────────────────────────────────────────────────────
let state = {};

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
    const isBetting  = state.phase === 'BETTING';
    const isPlaying  = state.phase === 'PLAYING';
    const isComplete = state.phase === 'ROUND_COMPLETE';
    const isGameOver = isComplete && state.balance <= 0;

    el.bettingCtrl.classList.toggle('hidden', !isBetting);
    el.actionCtrl.classList.toggle('hidden', !isPlaying);
    el.newRoundCtrl.classList.toggle('hidden', !isComplete || isGameOver);
    el.gameOverCtrl.classList.toggle('hidden', !isGameOver);

    if (isPlaying) {
        el.hitBtn.disabled    = false;
        el.standBtn.disabled  = false;
        el.doubleBtn.disabled = !state.isFirstAction || state.balance < state.bet;
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
}

function revealHoleCard(animated = true) {
    state.holeRevealed = true;
    const holeEl = el.dealerCards.children[1];
    if (!holeEl) return;
    const newCard = htmlToElement(cardHTML(state.dealerCards[1], false, 0, animated));
    el.dealerCards.replaceChild(newCard, holeEl);
    updateDealerScore();
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

    clearTable();
    updateHUDBalance();

    // Deal 4 cards with staggered animation
    appendCard(el.playerCards, state.playerCards[0], false, 0);
    appendCard(el.dealerCards, state.dealerCards[0], false, 0.12);
    appendCard(el.playerCards, state.playerCards[1], false, 0.24);
    appendCard(el.dealerCards, state.dealerCards[1], true,  0.36); // hole card

    updatePlayerScore();
    updateDealerScore();
    updatePhaseUI();

    // Natural blackjack check
    const playerBJ = isBlackjack(state.playerCards);
    const dealerBJ = isBlackjack(state.dealerCards);
    if (playerBJ || dealerBJ) {
        revealHoleCard(false);
        if (playerBJ && dealerBJ) resolveRound('PUSH');
        else if (playerBJ)        resolveRound('BLACKJACK');
        else                      resolveRound('LOSE');
    }
}

// ─── Player Actions ───────────────────────────────────────────────────────────
function playerHit() {
    if (state.phase !== 'PLAYING') return;
    hideHint();
    state.isFirstAction = false;
    const card = drawCard();
    state.playerCards.push(card);
    appendCard(el.playerCards, card, false, 0);
    updatePlayerScore();
    el.doubleBtn.disabled = true;

    if (isBust(state.playerCards))                   resolveRound('BUST');
    else if (handValue(state.playerCards).total === 21) playerStand();
}

function playerStand() {
    if (state.phase !== 'PLAYING') return;
    hideHint();
    state.phase = 'DEALER_PLAYING';
    revealHoleCard(true);
    updatePhaseUI();
    setTimeout(dealerPlay, 550);
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
// Set initial UI state without touching cards
el.hudBalance.textContent = `Balance: $${state.balance}`;
el.hudBet.textContent     = `Bet: $${state.bet}`;
el.bettingCtrl.classList.remove('hidden');
el.actionCtrl.classList.add('hidden');
el.newRoundCtrl.classList.add('hidden');
el.gameOverCtrl.classList.add('hidden');
el.dealBtn.disabled = true;
