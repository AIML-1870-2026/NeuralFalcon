// LLM agent — OpenAI API, prompt construction, JSON response parsing

let _apiKey = null;

function setApiKey(key) { _apiKey = key; }
function getApiKey() { return _apiKey; }

// ─── Prompt Builder ───────────────────────────────────────
function buildPrompt(gameState, explainDepth, playStyle, runningCount) {
    const { playerHand, playerTotal, isSoft, isPair, pairRank,
            dealerUpCard, balance, bet, canDouble, canSplit, deckComposition } = gameState;

    const depthInstructions = {
        basic:    'One sentence only: the recommended action and its single primary reason.',
        standard: 'One paragraph: cover the hand total, dealer threat level, and expected value of the recommended action.',
        deep:     'Full statistical breakdown: bust probabilities for each action, deck composition impact, alternative action analysis, and expected value estimates.',
    };

    const styleInstructions = {
        balanced:       'Follow standard basic strategy.',
        conservative:   'Play conservatively — minimize variance, avoid doubling or splitting on marginal edges, prioritize not busting.',
        aggressive:     'Maximize expected value even at high variance — favour doubling and splitting on any positive-EV edge.',
        'card-counter': `Card counting mode. Running count: ${runningCount ?? 0}. Factor deck richness into your recommendation.`,
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

Respond with ONLY valid JSON:
{
  "action": "<${availableActions.join('|')}>",
  "reasoning": "<your explanation>"
}`;
}

// ─── API Call (OpenAI) ────────────────────────────────────
async function queryAgent(gameState, explainDepth = 'standard', playStyle = 'balanced', runningCount = null, modelOverride = null) {
    if (!_apiKey) throw new Error('No API key loaded.');

    const model = modelOverride || 'gpt-4o';
    const prompt = buildPrompt(gameState, explainDepth, playStyle, runningCount);

    agentLog('info', 'Sending to ' + model, { prompt, gameState });

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + _apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            max_tokens: 512,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'You are an expert Blackjack strategy AI. Always respond with valid JSON.' },
                { role: 'user', content: prompt },
            ],
        }),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: { message: resp.statusText } }));
        const msg = err?.error?.message || resp.statusText;
        if (resp.status === 401) throw new Error('Auth failed (401) — check your OpenAI API key.');
        if (resp.status === 429) throw new Error('Rate limited (429) — wait a moment and retry.');
        throw new Error(`OpenAI error ${resp.status}: ${msg}`);
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    agentLog('info', 'Raw response from ' + model, raw);

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
    if (!valid.includes(action)) throw new Error(`Unexpected action "${action}".`);

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
