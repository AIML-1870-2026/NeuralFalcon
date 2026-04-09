// Product Review Generator — script.js

// ── Model catalog ──────────────────────────────────────────────
const MODELS = {
  'GPT-4o':  ['gpt-4o', 'gpt-4o-mini'],
  'GPT-4':   ['gpt-4-turbo', 'gpt-4'],
  'GPT-3.5': ['gpt-3.5-turbo'],
};

// ── State ──────────────────────────────────────────────────────
let apiKey = null;
let history = []; // session-only
let lastPlainText = '';

// ── Init ───────────────────────────────────────────────────────
updateModels();

function updateModels() {
  const family = document.getElementById('modelFamily').value;
  const sel = document.getElementById('modelSelect');
  sel.innerHTML = '';
  MODELS[family].forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });
}

// ── .env key loader ────────────────────────────────────────────
function loadKey() {
  const raw = document.getElementById('envInput').value.trim();
  if (!raw) return setKeyStatus('Paste your .env contents or key above.', '');

  const key = parseEnv(raw);
  if (key) {
    apiKey = key;
    document.getElementById('envInput').value = '';
    setKeyStatus('Key loaded ✓', 'ok');
  } else {
    setKeyStatus('Could not find OPENAI_API_KEY in the pasted text.', 'err');
  }
}

function parseEnv(text) {
  // Accept raw key (sk-...) or KEY=value lines
  if (/^sk-[A-Za-z0-9\-_]+$/.test(text)) return text;
  for (const line of text.split('\n')) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (k === 'OPENAI_API_KEY' && v) return v;
  }
  return null;
}

function setKeyStatus(msg, cls) {
  const el = document.getElementById('keyStatus');
  el.textContent = msg;
  el.className = cls;
}

// Allow pressing Enter in the key field to load
document.getElementById('envInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadKey();
});

// ── Prompt builder ─────────────────────────────────────────────
function buildPrompt() {
  const name     = document.getElementById('productName').value.trim() || 'Unknown Product';
  const category = document.getElementById('productCategory').value;
  const features = document.getElementById('keyFeatures').value.trim() || 'Not specified';
  const sentiment = document.getElementById('sentiment').value;
  const length   = document.getElementById('reviewLength').value;

  const wordMap = { Short: '~100 words', Medium: '~250 words', Long: '~500 words' };

  return `You are an experienced product reviewer. Write a ${sentiment.toLowerCase()} product review in markdown format.

Product: ${name}
Category: ${category}
Key Features:
${features}

Requirements:
- Tone: ${sentiment}
- Length: ${wordMap[length]}
- Format: Start with a markdown H2 title (include a star rating like ★★★★☆), then write review paragraphs. Use **bold** for emphasis on standout points.
- Do NOT include any preamble like "Here is your review". Just output the review directly.`;
}

// ── Generate ───────────────────────────────────────────────────
async function generate() {
  if (!apiKey) {
    showError('Please load your OpenAI API key first.');
    return;
  }

  const name = document.getElementById('productName').value.trim();
  if (!name) {
    showError('Please enter a product name.');
    return;
  }

  const model = document.getElementById('modelSelect').value;
  const prompt = buildPrompt();

  setGenerating(true);
  clearError();

  let fullText = '';

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: { message: resp.statusText } }));
      const msg = err?.error?.message || resp.statusText;
      if (resp.status === 401) throw new Error('Authentication failed (401). Check your OpenAI API key.');
      if (resp.status === 429) throw new Error('Rate limited by OpenAI. Please wait a moment and try again.');
      throw new Error('OpenAI error ' + resp.status + ': ' + msg);
    }

    // Show output card while streaming
    showOutputCard();
    document.getElementById('reviewOutput').innerHTML = '';

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const ev = JSON.parse(data);
          const delta = ev.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            document.getElementById('reviewOutput').innerHTML = marked.parse(fullText);
          }
        } catch (_) {}
      }
    }

    lastPlainText = fullText;
    addToHistory(name, model, fullText);

  } catch (err) {
    showError(err.message);
    if (!fullText) hideOutputCard();
  } finally {
    setGenerating(false);
  }
}

// ── UI helpers ─────────────────────────────────────────────────
function setGenerating(on) {
  const btn = document.getElementById('generateBtn');
  btn.disabled = on;
  btn.innerHTML = on
    ? '<span class="spinner"></span>Generating…'
    : 'Generate Review';
}

function showOutputCard()  { document.getElementById('outputCard').classList.add('visible'); }
function hideOutputCard()  { document.getElementById('outputCard').classList.remove('visible'); }

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.classList.add('visible');
}
function clearError() {
  const el = document.getElementById('errorMsg');
  el.textContent = '';
  el.classList.remove('visible');
}

// ── Copy & Download ────────────────────────────────────────────
function copyReview() {
  if (!lastPlainText) return;
  navigator.clipboard.writeText(lastPlainText).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  });
}

function downloadReview() {
  if (!lastPlainText) return;
  const name = (document.getElementById('productName').value.trim() || 'review')
    .toLowerCase().replace(/\s+/g, '-');
  const blob = new Blob([lastPlainText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name + '-review.txt';
  a.click();
  URL.revokeObjectURL(url);
}

// ── History ────────────────────────────────────────────────────
function addToHistory(productName, model, text) {
  const entry = { productName, model, text, ts: Date.now() };
  history.unshift(entry);
  renderHistory();
  document.getElementById('historyCard').classList.add('visible');
}

function renderHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  history.forEach((entry, i) => {
    const div = document.createElement('div');
    div.className = 'hist-entry';
    div.innerHTML = `
      <div class="hist-meta">${entry.productName} · ${entry.model} · ${formatTime(entry.ts)}</div>
      <div class="hist-preview">${entry.text.replace(/[#*`]/g, '').slice(0, 120)}…</div>`;
    div.addEventListener('click', () => restoreHistory(i));
    list.appendChild(div);
  });
}

function restoreHistory(i) {
  const entry = history[i];
  lastPlainText = entry.text;
  document.getElementById('reviewOutput').innerHTML = marked.parse(entry.text);
  showOutputCard();
  window.scrollTo({ top: document.getElementById('outputCard').offsetTop - 20, behavior: 'smooth' });
}

function clearHistory() {
  history = [];
  lastPlainText = '';
  document.getElementById('historyList').innerHTML = '';
  document.getElementById('historyCard').classList.remove('visible');
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
