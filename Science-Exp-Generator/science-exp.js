// Science Experiment Generator — science-exp.js

// ── CORS proxy & constants ──────────────────────────────────────
const PROXY    = 'https://corsproxy.io/?';
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MODEL    = 'gpt-4o-mini';

// ── State ───────────────────────────────────────────────────────
let apiKey       = null;
let lastMd       = '';
let lastGrade    = '';
let lastSupplies = '';
let history      = JSON.parse(sessionStorage.getItem('sci-exp-history') || '[]');

// ── Quick-pick chips ────────────────────────────────────────────
const COMMON_SUPPLIES = [
  'baking soda', 'vinegar', 'salt', 'sugar', 'food coloring',
  'plastic cups', 'balloons', 'tape', 'paper towels', 'rubber bands',
  'aluminum foil', 'candle', 'string', 'dish soap', 'cooking oil',
  'cornstarch', 'lemon juice', 'ice', 'matches', 'magnifying glass',
];

const SUPPLY_EMOJI = {
  'baking soda':      '🥄',
  'vinegar':          '🍶',
  'salt':             '🧂',
  'sugar':            '🍬',
  'food coloring':    '🎨',
  'plastic cups':     '🥤',
  'balloons':         '🎈',
  'tape':             '📎',
  'paper towels':     '🧻',
  'rubber bands':     '🔗',
  'aluminum foil':    '🔲',
  'candle':           '🕯️',
  'string':           '🧵',
  'dish soap':        '🫧',
  'cooking oil':      '🫙',
  'cornstarch':       '🌽',
  'lemon juice':      '🍋',
  'ice':              '🧊',
  'matches':          '🔥',
  'magnifying glass': '🔍',
};

(function initChips() {
  const wrap = document.getElementById('chipsWrap');
  COMMON_SUPPLIES.forEach(s => {
    const btn       = document.createElement('button');
    btn.className   = 'chip';
    btn.innerHTML   = `<span class="chip-img">${SUPPLY_EMOJI[s] || '🔬'}</span><span class="chip-label">${s}</span>`;
    btn.onclick     = () => appendSupply(s);
    wrap.appendChild(btn);
  });
})();

function appendSupply(s) {
  const ta  = document.getElementById('supplies');
  const cur = ta.value.trim();
  ta.value  = cur ? cur + ', ' + s : s;
  ta.focus();
}

// ── Key loading ─────────────────────────────────────────────────
function loadManual() {
  const raw = document.getElementById('manualKey').value.trim();
  if (!raw) return setKeyStatus('Paste your sk-... key above.', 'err');
  if (!raw.startsWith('sk-'))
    return setKeyStatus('Key should start with sk-. Got: ' + raw.slice(0, 20), 'err');
  apiKey = raw;
  document.getElementById('manualKey').value = '';
  setKeyStatus('Key loaded \u2713 \u2014 ' + raw.slice(0, 12) + '...' + raw.slice(-4), 'ok');
}

function applyText(text) {
  const key = parseEnv(text) || parseCsv(text);
  if (!key) {
    setKeyStatus(
      'Could not parse key. Read: ' + text.trim().slice(0, 60).replace(/\n/g, ' \u21b5 '),
      'err'
    );
    return;
  }
  apiKey = key;
  setKeyStatus('Key loaded \u2713 \u2014 ' + key.slice(0, 12) + '...' + key.slice(-4), 'ok');
}

function unquote(s) { return s.trim().replace(/^["']|["']$/g, ''); }
function cleanKey(s) { return s.replace(/["'\s]/g, ''); }

function parseEnv(text) {
  const t = text.trim().replace(/\r/g, '');
  if (t.startsWith('sk-') && !t.includes('\n') && !t.includes('=')) return t;
  for (const line of t.split('\n')) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = unquote(line.slice(0, idx));
    const v = unquote(line.slice(idx + 1));
    if (k === 'OPENAI_API_KEY' && v) return cleanKey(v);
  }
  return null;
}

function parseCsvRow(line) {
  const cells = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ;
    } else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  cells.push(cur.trim());
  return cells;
}

function parseCsv(text) {
  const rows = text.replace(/\r/g, '').split('\n').filter(Boolean).map(parseCsvRow);
  if (!rows.length) return null;
  const header = rows[0].map(h => h.toLowerCase());
  const vi     = header.indexOf('value');
  for (const row of rows.slice(1)) {
    if (row.some(c => c.toLowerCase().includes('openai'))) {
      if (vi >= 0 && row[vi]) return cleanKey(row[vi]);
      const sk = row.find(c => c.replace(/["']/g, '').startsWith('sk-'));
      if (sk) return cleanKey(sk);
    }
  }
  for (const row of rows) {
    const sk = row.find(c => c.replace(/["']/g, '').startsWith('sk-'));
    if (sk) return cleanKey(sk);
  }
  return null;
}

function setKeyStatus(msg, cls) {
  const el       = document.getElementById('keyStatus');
  el.textContent = msg;
  el.className   = cls;
  const badge    = document.getElementById('keyBadge');
  if (cls === 'ok') {
    badge.textContent = msg;
    badge.className   = 'key-badge key-badge--ok';
  } else {
    badge.textContent = 'No API key loaded';
    badge.className   = 'key-badge key-badge--missing';
  }
}

// ── File drag-drop ──────────────────────────────────────────────
function onFileChange(e) { readFile(e.target.files[0]); }
function onDragOver(e)   { e.preventDefault(); document.getElementById('dropZone').classList.add('drag-over'); }
function onDragLeave()   { document.getElementById('dropZone').classList.remove('drag-over'); }
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag-over');
  readFile(e.dataTransfer.files[0]);
}
function readFile(file) {
  if (!file) return;
  const r  = new FileReader();
  r.onload = ev => applyText(ev.target.result);
  r.readAsText(file);
}

document.getElementById('manualKey').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadManual();
});

// ── System prompt ───────────────────────────────────────────────
function buildSystemPrompt() {
  return `You are a creative science educator specializing in hands-on experiments for K-12 students.
When given a grade level and a list of available supplies, generate a single, engaging science experiment that:
- Is appropriate for the specified grade level
- Uses ONLY the supplies listed (or common items assumed to be available like water, paper, tape)
- Includes: experiment title, learning objective, materials list, step-by-step instructions, expected results, and a brief explanation of the science concept
- Is safe, clear, and encouraging in tone

IMPORTANT: The very first line of your response must be exactly one of these three (no other text on that line):
DIFFICULTY: Easy
DIFFICULTY: Medium
DIFFICULTY: Hard

After that first line, write the experiment in markdown with clear headers and numbered steps.

Then, after the full experiment, output a line containing only: ===WORKSHEET===

After that delimiter, write a printable student worksheet in markdown tailored specifically to this experiment:
- ## [Experiment Title] — Student Worksheet
- **Name:** _________________________ &nbsp;&nbsp; **Date:** _________________________
- **My Hypothesis:** I think that _______________________________________________
- Then 3 specific observation questions written for THIS experiment (e.g. "How many seconds did the fizzing last?", "What color change did you observe?"). Format each as a bold question followed by a blank line for the answer.
- **My Conclusion:** I learned that _______________________________________________
- **Did your results match your hypothesis?** &nbsp; [ ] Yes &nbsp;&nbsp; [ ] No`;
}

// ── Generate ────────────────────────────────────────────────────
async function generate() {
  clearError();

  if (!apiKey) { showError('Please load your OpenAI API key first.'); return; }

  const grade    = document.getElementById('gradeLevel').value;
  const supplies = document.getElementById('supplies').value.trim();

  if (!supplies) {
    document.getElementById('suppliesErr').classList.add('visible');
    return;
  }
  document.getElementById('suppliesErr').classList.remove('visible');

  setGenerating(true);
  hideOutputCard();

  try {
    const resp = await fetch(PROXY + ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:    MODEL,
        stream:   false,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user',   content: 'Grade level: ' + grade + '\nAvailable supplies: ' + supplies },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: { message: resp.statusText } }));
      const msg = err?.error?.message || resp.statusText;
      if (resp.status === 401) throw new Error('Authentication failed (401): ' + msg);
      if (resp.status === 429) throw new Error('Rate limited by OpenAI. Please wait a moment and try again.');
      throw new Error('OpenAI error ' + resp.status + ': ' + msg);
    }

    const data = await resp.json();
    const full = data.choices?.[0]?.message?.content || '';
    if (!full) throw new Error('No response received from OpenAI.');

    lastMd       = full;
    lastGrade    = grade;
    lastSupplies = supplies;

    renderOutput(full);
    saveHistory(grade, supplies, full);

  } catch (err) {
    showError(err.message);
  } finally {
    setGenerating(false);
  }
}

// ── Render output ───────────────────────────────────────────────
function renderOutput(md) {
  // Split difficulty line
  const lines = md.split('\n');
  let diff = null;
  let rest = md;

  if (lines[0].trim().startsWith('DIFFICULTY:')) {
    diff = lines[0].replace('DIFFICULTY:', '').trim().toLowerCase();
    rest = lines.slice(1).join('\n').trimStart();
  }

  // Split experiment from worksheet
  const WORKSHEET_DELIM = '===WORKSHEET===';
  const delimIdx = rest.indexOf(WORKSHEET_DELIM);
  const expMd       = delimIdx >= 0 ? rest.slice(0, delimIdx).trimEnd() : rest;
  const worksheetMd = delimIdx >= 0 ? rest.slice(delimIdx + WORKSHEET_DELIM.length).trimStart() : '';

  // Difficulty badge
  const badge = document.getElementById('diffBadge');
  if (diff) {
    const label       = diff.charAt(0).toUpperCase() + diff.slice(1);
    badge.textContent = 'Difficulty: ' + label;
    badge.className   = 'visible ' + diff;
  } else {
    badge.className = '';
  }

  document.getElementById('expOutput').innerHTML = marked.parse(expMd);
  document.getElementById('worksheetOutput').innerHTML = worksheetMd ? marked.parse(worksheetMd) : '';
  document.getElementById('observationOutput').innerHTML = buildObsSheet(expMd);

  showOutputCard();
  document.getElementById('subCard').classList.add('visible');
  window.scrollTo({ top: document.getElementById('outputCard').offsetTop - 20, behavior: 'smooth' });
}

// ── UI helpers ──────────────────────────────────────────────────
function setGenerating(on) {
  const btn     = document.getElementById('generateBtn');
  btn.disabled  = on;
  btn.innerHTML = on
    ? '<span class="spinner"></span>Generating\u2026'
    : 'Generate Experiment';
}
function showOutputCard() { document.getElementById('outputCard').classList.add('visible'); }
function hideOutputCard() { document.getElementById('outputCard').classList.remove('visible'); }
function showError(msg)   {
  const e = document.getElementById('errorMsg');
  e.textContent = msg;
  e.classList.add('visible');
}
function clearError() {
  const e = document.getElementById('errorMsg');
  e.textContent = '';
  e.classList.remove('visible');
}

// ── Copy & Print ────────────────────────────────────────────────
function copyExp() {
  if (!lastMd) return;
  navigator.clipboard.writeText(lastMd).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
}


// ── Observation sheet builder ────────────────────────────────────
function buildObsSheet(expMd) {
  const titleMatch = expMd.match(/^##\s+(.+)$/m);
  const title      = titleMatch ? titleMatch[1].trim() : 'Science Experiment';

  function blankLines(n) {
    return Array(n).fill('<div class="obs-blank-line"></div>').join('');
  }

  return `
    <div class="obs-sheet">
      <h2>${title} &mdash; Observation Sheet</h2>
      <div class="obs-field-row">
        <div class="obs-field"><strong>Name:</strong><div class="obs-blank-line"></div></div>
        <div class="obs-field"><strong>Date:</strong><div class="obs-blank-line"></div></div>
      </div>
      <div class="obs-section">
        <h3>Before: My Hypothesis</h3>
        <p>I think that&hellip;</p>
        ${blankLines(3)}
      </div>
      <div class="obs-section">
        <h3>During: What I Observed</h3>
        <p>Write or draw what you notice as the experiment happens.</p>
        ${blankLines(6)}
      </div>
      <div class="obs-section obs-draw-box">
        <h3>Sketch / Drawing</h3>
        <div class="draw-area"></div>
      </div>
      <div class="obs-section">
        <h3>After: What Happened</h3>
        ${blankLines(4)}
      </div>
      <div class="obs-section">
        <h3>My Conclusion</h3>
        <p>I learned that&hellip;</p>
        ${blankLines(3)}
        <p style="margin-top:1rem"><strong>Did your results match your hypothesis?</strong>
          &nbsp;&nbsp; [ ] Yes &nbsp;&nbsp; [ ] No</p>
      </div>
    </div>`;
}

// ── Supply Substitution ─────────────────────────────────────────
async function getSubstitution() {
  const missing = document.getElementById('missingSupply').value.trim();
  if (!missing || !lastMd) return;

  const btn       = document.getElementById('subBtn');
  btn.disabled    = true;
  btn.textContent = 'Loading\u2026';
  document.getElementById('subOutput').innerHTML = '';

  try {
    const resp = await fetch(PROXY + ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:    MODEL,
        stream:   false,
        messages: [{
          role:    'user',
          content: `I am doing a grade ${lastGrade} science experiment using: ${lastSupplies}.\nI do not have: ${missing}.\nSuggest 2-3 practical household substitutes. For each, briefly explain why it works as a replacement. Use a short markdown list.`,
        }],
      }),
    });

    if (!resp.ok) throw new Error('OpenAI error ' + resp.status);
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    document.getElementById('subOutput').innerHTML = marked.parse(text);
  } catch (err) {
    document.getElementById('subOutput').textContent = 'Error: ' + err.message;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Suggest';
  }
}

document.getElementById('missingSupply').addEventListener('keydown', e => {
  if (e.key === 'Enter') getSubstitution();
});

// ── History (sessionStorage) ────────────────────────────────────
function saveHistory(grade, supplies, md) {
  history.unshift({ grade, supplies, md, ts: Date.now() });
  if (history.length > 10) history = history.slice(0, 10);
  sessionStorage.setItem('sci-exp-history', JSON.stringify(history));
  renderHistoryUI();
  document.getElementById('historyCard').classList.add('visible');
}

function renderHistoryUI() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  history.forEach(entry => {
    const div     = document.createElement('div');
    div.className = 'hist-entry';
    const preview = entry.md
      .replace(/DIFFICULTY:[^\n]+\n/, '')
      .replace(/[#*`]/g, '')
      .slice(0, 110);
    div.innerHTML = `
      <div class="hist-meta">Grade ${entry.grade} &middot; ${formatTime(entry.ts)}</div>
      <div class="hist-preview">${preview}&hellip;</div>`;
    div.addEventListener('click', () => {
      lastMd       = entry.md;
      lastGrade    = entry.grade;
      lastSupplies = entry.supplies;
      renderOutput(entry.md);
    });
    list.appendChild(div);
  });
}

function clearHistory() {
  history = [];
  sessionStorage.removeItem('sci-exp-history');
  document.getElementById('historyList').innerHTML = '';
  document.getElementById('historyCard').classList.remove('visible');
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Restore history on page load
if (history.length) {
  renderHistoryUI();
  document.getElementById('historyCard').classList.add('visible');
}
