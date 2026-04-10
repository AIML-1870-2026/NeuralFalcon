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

// ── Key loader ─────────────────────────────────────────────────
function loadKey() {
  const raw = document.getElementById('envInput').value.trim();
  if (!raw) return setKeyStatus('Paste your .env contents above.', '');
  applyText(raw);
}

function applyText(text) {
  const key = parseEnv(text) || parseCsv(text);
  if (key) {
    apiKey = key;
    document.getElementById('envInput').value = '';
    setKeyStatus('Key loaded ✓', 'ok');
  } else {
    setKeyStatus('Could not find OPENAI_API_KEY in the pasted text.', 'err');
  }
}

function parseEnv(text) {
  const t = text.trim();
  // Accept any sk- key directly (no strict character whitelist)
  if (t.startsWith('sk-') && !t.includes('\n') && !t.includes('=')) return t;
  for (const line of t.split('\n')) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (k === 'OPENAI_API_KEY' && v) return v;
  }
  return null;
}

function parseCsv(text) {
  // Standard format: header row "name,key", then "openai,sk-..."
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // Skip header row, scan all rows for openai key
  for (const line of lines.slice(1)) {
    const parts = line.split(',').map(s => s.trim());
    if (parts[0]?.toLowerCase() === 'openai' && parts[1]) return parts[1];
  }
  // Fallback: grab any cell that looks like an OpenAI key
  for (const line of lines) {
    for (const cell of line.split(',')) {
      const v = cell.trim();
      if (v.startsWith('sk-')) return v;
    }
  }
  return null;
}

function setKeyStatus(msg, cls) {
  const el = document.getElementById('keyStatus');
  el.textContent = msg;
  el.className = cls;
}

// File drag-and-drop / browse
function onFileChange(e) { readFile(e.target.files[0]); }

function onDragOver(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.add('drag-over');
}
function onDragLeave(_e) {
  document.getElementById('dropZone').classList.remove('drag-over');
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag-over');
  readFile(e.dataTransfer.files[0]);
}

function readFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => applyText(ev.target.result);
  reader.readAsText(file);
}

// Allow pressing Enter in the key field to load
document.getElementById('envInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadKey();
});

// ── Slider helpers ─────────────────────────────────────────────
const SENTIMENT_LABELS = { '-1': 'Negative', '0': 'Neutral', '1': 'Positive' };
const LENGTH_MAP = { 1: ['Short', '~100 words'], 2: ['Medium', '~250 words'], 3: ['Long', '~500 words'] };

function updateSlider(input) {
  const el = document.getElementById(input.id + '-val');
  const label = SENTIMENT_LABELS[input.value];
  el.textContent = label;
  el.className = 'aspect-val ' + label.toLowerCase();
}

function updateLengthLabel(input) {
  const [name, words] = LENGTH_MAP[input.value];
  document.getElementById('lengthLabel').textContent = `${name} (${words})`;
}

function getAspects() {
  return [
    { name: 'Price / Value', id: 'sentPrice' },
    { name: 'Features',      id: 'sentFeatures' },
    { name: 'Build Quality', id: 'sentBuild' },
    { name: 'Usability',     id: 'sentUsability' },
  ].map(a => ({ name: a.name, sentiment: SENTIMENT_LABELS[document.getElementById(a.id).value] }));
}

// ── Prompt builder ─────────────────────────────────────────────
function buildPrompt() {
  const name     = document.getElementById('productName').value.trim() || 'Unknown Product';
  const category = document.getElementById('productCategory').value;
  const features = document.getElementById('keyFeatures').value.trim() || 'Not specified';
  const lengthVal = parseInt(document.getElementById('reviewLength').value);
  const [, words] = LENGTH_MAP[lengthVal];
  const aspects  = getAspects();

  const aspectLines = aspects.map(a => `  - ${a.name}: ${a.sentiment}`).join('\n');

  return `You are an experienced product reviewer. Write a product review in markdown format.

Product: ${name}
Category: ${category}
Key Features:
${features}

Sentiment by aspect:
${aspectLines}

Requirements:
- Reflect each aspect's sentiment in the review — be critical where negative, enthusiastic where positive, balanced where neutral.
- Length: ${words}
- Format: Start with a markdown H2 title (include a star rating like ★★★★☆ based on overall sentiment), then write review paragraphs. Use **bold** for standout points.
- Do NOT include any preamble like "Here is your review". Output the review directly.`;
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
      if (resp.status === 401) throw new Error('Authentication failed (401): ' + msg);
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
