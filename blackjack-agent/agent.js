// LLM agent — prompt construction, Anthropic API call, JSON response parsing
// Fetch/error patterns adapted from LLM-API-Tester reference implementation

let _apiKey = null;

function setApiKey(key) { _apiKey = key; }

// ─── Prompt Builder ───────────────────────────────────────
function buildPrompt(gameState, explainDepth, playStyle, runningCount) {
    const { playerHand, playerTotal, isSoft, isPair, pairRank,
            dealerUpCard, balance, bet, canDouble, canSplit, deckComposition } = gameState;

    const depthInstructions = {
        basic:    'One sentence only: the recommended action and its single primary reason.',
        standard: 'One paragraph: cover the hand total, dealer threat level, and expected value of the recommended action.',
        deep:     'Full statistical breakdown: bust probabilities for each action, deck composition impact, alternative action analysis, and exact expected value estimates.',
    };

    const styleInstructions = {
        balanced:       'Follow standard basic strategy.',
        conservative:   'Play conservatively — minimize variance, avoid doubling or splitting on marginal edges, prioritize not busting.',
        aggressive:     'Maximize expected value even at high variance — favour doubling and splitting on any positive-EV edge.',
        'card-counter': `Card counting mode. Running count: ${runningCount ?? 0}. Factor deck richness (high count = more tens/aces remaining) into your recommendation.`,
    };

    const deckCtx = deckComposition
        ? '\nDeck composition remaining: ' + Object.entries(deckComposition)
              .map(([r, n]) => `${r}:${n}`).join(', ')
        : '';

    const availableActions = ['hit', 'stand'];
    if (canDouble) availableActions.push('double');
    if (canSplit)  availableActions.push('split');

    return `You are an expert Blackjack AI. Analyze the game state and return the optimal action.

Game state:
- Player hand: ${playerHand.join(', ')} (total: ${playerTotal}, ${isSoft ? 'soft' : 'hard'})
- Dealer up card: ${dealerUpCard}
- Available actions: ${availableActions.join(', ')}
- Balance: $${balance} | Current bet: $${bet}${deckCtx}

Play style: ${styleInstructions[playStyle] || styleInstructions.balanced}
Explanation depth: ${depthInstructions[explainDepth] || depthInstructions.standard}

Respond with ONLY valid JSON — no markdown, no prose outside the object:
{
  "action": "<${availableActions.join('|')}>",
  "reasoning": "<your explanation>"
}`;
}

// ─── API Call ─────────────────────────────────────────────
async function queryAgent(gameState, explainDepth = 'standard', playStyle = 'balanced', runningCount = null, modelOverride = null) {
    if (!_apiKey) throw new Error('No API key loaded. Upload a .env file first.');

    const model = modelOverride || 'claude-sonnet-4-6';
    const prompt = buildPrompt(gameState, explainDepth, playStyle, runningCount);

    agentLog('info', 'Sending to ' + model, { prompt, gameState });

    // Exact fetch structure from LLM-API-Tester reference
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': _apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model,
            max_tokens: 512,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    // Error handling pattern from LLM-API-Tester reference
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: { message: resp.statusText } }));
        const msg = err?.error?.message || resp.statusText;
        if (resp.status === 401) throw new Error('Auth failed (401) — check your Anthropic API key.');
        if (resp.status === 429) throw new Error('Rate limited (429) — wait a moment and retry.');
        throw new Error(`API error ${resp.status}: ${msg}`);
    }

    const data = await resp.json();
    const raw = data.content?.[0]?.text ?? '';
    agentLog('info', 'Raw response from ' + model, raw);

    // Parse JSON — fall back to regex extraction if model adds surrounding prose
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        const match = raw.match(/\{[\s\S]*?\}/);
        if (!match) throw new Error('Could not parse JSON from model response.');
        parsed = JSON.parse(match[0]);
    }

    const action = (parsed.action ?? '').toLowerCase().trim();
    const valid = ['hit', 'stand', 'double', 'split'];
    if (!valid.includes(action)) throw new Error(`Unexpected action "${action}" — expected one of: ${valid.join(', ')}.`);

    agentLog('info', 'Parsed action', { action, reasoning: parsed.reasoning });
    return { action, reasoning: parsed.reasoning ?? '' };
}

// ─── Console Logger ───────────────────────────────────────
function agentLog(level, message, data) {
    const time = new Date().toLocaleTimeString();
    const entry = `[${time}] ${message}`;
    console[level === 'error' ? 'error' : 'log'](entry, data ?? '');

    const el = document.getElementById('console-output');
    if (!el) return;
    const div = document.createElement('div');
    div.className = `log-entry ${level}`;
    div.textContent = entry + (data != null
        ? ': ' + (typeof data === 'string' ? data : JSON.stringify(data))
        : '');
    el.prepend(div);
}
