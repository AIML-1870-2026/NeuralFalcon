/* Drug Safety Explorer — app.js */

'use strict';

/* ── Constants ───────────────────────────────────────── */
const FDA = 'https://api.fda.gov';
const ENDPOINTS = {
  events:      `${FDA}/drug/event.json`,
  label:       `${FDA}/drug/label.json`,
  enforcement: `${FDA}/drug/enforcement.json`,
};

/* ── Educational popup content ──────────────────────── */
const POPUP_CONTENT = {
  events: {
    title: 'About Adverse Events (FAERS)',
    body: `
      <h4>What is this data?</h4>
      <p>These reports come from the FDA Adverse Event Reporting System (FAERS) — a database of voluntary safety reports submitted by patients, healthcare providers, and manufacturers.</p>
      <h4>How is it collected?</h4>
      <p>Anyone can submit a report to FDA MedWatch. Most reports come from healthcare professionals and drug manufacturers, who are required by law to report serious events.</p>
      <h4>What it can tell you</h4>
      <p>Which reactions have been reported in association with a drug, and how frequently those reports appear in the database.</p>
      <h4>What it cannot tell you</h4>
      <p>A report does not mean the drug caused the reaction. Counts reflect reports, not confirmed cases. Under-reporting is common — only a fraction of real-world events are ever submitted.</p>
    `
  },
  label: {
    title: 'About Label & Warnings',
    body: `
      <h4>What is this data?</h4>
      <p>This is the official FDA-approved drug label (also called the "package insert") — the same document that comes with prescription drugs.</p>
      <h4>How is it collected?</h4>
      <p>Labels are reviewed and approved by the FDA before a drug can be marketed. They are updated when new safety information becomes available.</p>
      <h4>What it can tell you</h4>
      <p>Official warnings, contraindications, drug interactions, and known adverse reactions as approved by the FDA.</p>
      <h4>What it cannot tell you</h4>
      <p>Labels may not reflect the most recent post-market experience. Not all drugs have complete structured label data in OpenFDA.</p>
    `
  },
  recalls: {
    title: 'About Recall History',
    body: `
      <h4>What is this data?</h4>
      <p>These are FDA drug recall enforcement reports — actions taken by manufacturers to remove products from the market.</p>
      <h4>How is it collected?</h4>
      <p>FDA publishes recall notices after companies voluntarily recall products or after FDA requests a recall. Records go back to the 1990s.</p>
      <h4>What it can tell you</h4>
      <p>Whether a drug (or formulation) has been recalled, the reason for the recall, and its severity classification.</p>
      <h4>What it cannot tell you</h4>
      <p>A recall does not mean the drug is dangerous in general — most are due to manufacturing issues like labeling errors or contamination of specific lots.</p>
    `
  }
};

/* ── State ───────────────────────────────────────────── */
const state = {
  panels: ['a', 'b'],
  drugs: { a: null, b: null },
  activeTab: { a: 'events', b: 'events' },
  sortState: { a: { col: 'count', dir: 'desc' }, b: { col: 'count', dir: 'desc' } },
  acTimers: {},
  chartInstances: {}
};

/* ── DOM refs ────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const splash = $('splash');
const btnStart = $('btn-start');
const btnCompare = $('btn-compare');
const searchError = $('search-error');
const modalOverlay = $('modal-overlay');
const modalTitle = $('modal-title');
const modalBody = $('modal-body');

/* ── Splash ──────────────────────────────────────────── */
btnStart.addEventListener('click', () => splash.classList.add('hidden'));

/* ── Autocomplete ────────────────────────────────────── */
function setupAutocomplete(side) {
  const input = $(`drug-${side}`);
  const dropdown = $(`ac-${side}`);
  let acIdx = -1;

  input.addEventListener('input', () => {
    clearTimeout(state.acTimers[side]);
    const q = input.value.trim();
    if (q.length < 2) { hideDropdown(dropdown); return; }
    state.acTimers[side] = setTimeout(() => fetchSuggestions(q, dropdown, input), 300);
  });

  input.addEventListener('keydown', e => {
    const items = dropdown.querySelectorAll('.ac-item');
    if (e.key === 'ArrowDown') {
      acIdx = Math.min(acIdx + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === acIdx));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      acIdx = Math.max(acIdx - 1, 0);
      items.forEach((el, i) => el.classList.toggle('active', i === acIdx));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (acIdx >= 0 && items[acIdx]) { input.value = items[acIdx].textContent; hideDropdown(dropdown); acIdx = -1; }
    } else if (e.key === 'Escape') { hideDropdown(dropdown); acIdx = -1; }
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) hideDropdown(dropdown);
  });
}

// Uses RxNorm (NIH) — pharmaceutical drugs only, no cosmetics/personal care
async function fetchSuggestions(q, dropdown, input) {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=8`;
    const res = await fetch(url);
    if (!res.ok) { hideDropdown(dropdown); return; }
    const data = await res.json();
    const candidates = data.approximateGroup?.candidate || [];
    const seen = new Set();
    const list = [];
    for (const c of candidates) {
      const name = c.name;
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push(name);
        if (list.length === 6) break;
      }
    }
    if (!list.length) { hideDropdown(dropdown); return; }
    dropdown.innerHTML = list.map(n => `<div class="ac-item">${escHtml(n)}</div>`).join('');
    dropdown.classList.remove('hidden');
    dropdown.querySelectorAll('.ac-item').forEach(el => {
      el.addEventListener('mousedown', () => {
        input.value = el.textContent;
        hideDropdown(dropdown);
      });
    });
  } catch { hideDropdown(dropdown); }
}

function hideDropdown(dropdown) {
  dropdown.classList.add('hidden');
  dropdown.innerHTML = '';
}

setupAutocomplete('a');
setupAutocomplete('b');

/* ── Compare ─────────────────────────────────────────── */
btnCompare.addEventListener('click', runComparison);

function runComparison() {
  const drugA = $('drug-a').value.trim();
  const drugB = $('drug-b').value.trim();
  searchError.textContent = '';
  if (!drugA || !drugB) {
    searchError.textContent = 'Please enter both drug names before comparing.';
    return;
  }
  state.drugs.a = drugA;
  state.drugs.b = drugB;
  hideDropdown($('ac-a'));
  hideDropdown($('ac-b'));
  ['a', 'b'].forEach(side => loadPanel(side));
  loadInteractions(drugA, drugB);
}

/* ── Panel loading ───────────────────────────────────── */
function loadPanel(side) {
  const drug = state.drugs[side];
  $(`panel-name-${side}`).textContent = drug;
  state.activeTab[side] = 'events';
  setActiveTab(side, 'events');
  ['events', 'label', 'recalls'].forEach(tab => {
    setTabLoading(side, tab);
  });
  fetchEvents(side, drug);
  fetchLabel(side, drug);
  fetchRecalls(side, drug);
}

/* ── Tab switching ───────────────────────────────────── */
function setActiveTab(side, tab) {
  state.activeTab[side] = tab;
  ['events', 'label', 'recalls'].forEach(t => {
    $(`tab-btn-${side}-${t}`).classList.toggle('active', t === tab);
    $(`tab-${side}-${t}`).classList.toggle('active', t === tab);
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const { side, tab } = btn.dataset;
    setActiveTab(side, tab);
  });
});

/* ── Loading helpers ─────────────────────────────────── */
function setTabLoading(side, tab) {
  $(`tab-${side}-${tab}`).innerHTML = `<div class="loading-wrap"><div class="spinner"></div><p>Loading…</p></div>`;
}
function setTabError(side, tab, msg) {
  $(`tab-${side}-${tab}`).innerHTML = `<div class="empty-state error">${escHtml(msg)}<br><button class="read-more-btn" onclick="retryTab('${side}','${tab}')">Retry</button></div>`;
}
function setTabEmpty(side, tab, msg, cls) {
  $(`tab-${side}-${tab}`).innerHTML = `<div class="empty-state ${cls || ''}">${escHtml(msg)}</div>`;
}

function retryTab(side, tab) {
  setTabLoading(side, tab);
  const drug = state.drugs[side];
  if (tab === 'events') fetchEvents(side, drug);
  else if (tab === 'label') fetchLabel(side, drug);
  else fetchRecalls(side, drug);
}

/* ── Adverse Events ──────────────────────────────────── */
async function fetchEvents(side, drug) {
  try {
    const url = `${ENDPOINTS.events}?search=patient.drug.medicinalproduct:"${encodeURIComponent(drug)}"&count=patient.reaction.reactionmeddrapt.exact&limit=10`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) { setTabEmpty(side, 'events', `No adverse event reports found for "${drug}".`); return; }
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    renderEvents(side, data.results || [], drug);
  } catch (e) {
    setTabError(side, 'events', 'Unable to load data. Please try again.');
  }
}

function renderEvents(side, results, drug) {
  if (!results.length) { setTabEmpty(side, 'events', `No adverse event reports found for "${drug}".`); return; }

  const tableData = results.map(r => ({ name: r.term, count: r.count }));
  state[`eventsData_${side}`] = tableData;
  state.sortState[side] = { col: 'count', dir: 'desc' };

  const total = tableData.reduce((s, r) => s + r.count, 0);
  const container = $(`tab-${side}-events`);
  container.innerHTML = `
    <p class="ae-total">Total reports: <strong>${total.toLocaleString()}</strong></p>
    <div class="chart-wrap"><canvas id="chart-${side}" height="220"></canvas></div>
    <table class="ae-table" id="ae-table-${side}">
      <thead><tr>
        <th data-col="name" data-side="${side}">Reaction <span class="sort-arrow">↕</span></th>
        <th data-col="count" data-side="${side}">Reports <span class="sort-arrow">↓</span></th>
      </tr></thead>
      <tbody id="ae-tbody-${side}"></tbody>
    </table>`;

  renderAeTable(side, tableData);
  drawChart(side, tableData);

  container.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => sortAeTable(side, th.dataset.col));
  });
}

function renderAeTable(side, data) {
  const tbody = $(`ae-tbody-${side}`);
  const { col, dir } = state.sortState[side];
  const sorted = [...data].sort((a, b) => {
    const av = a[col], bv = b[col];
    if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return dir === 'asc' ? av - bv : bv - av;
  });
  tbody.innerHTML = sorted.map(r => `<tr><td>${escHtml(r.name)}</td><td>${r.count.toLocaleString()}</td></tr>`).join('');
  // update arrows
  $(`ae-table-${side}`).querySelectorAll('th[data-col]').forEach(th => {
    const arrow = th.querySelector('.sort-arrow');
    if (th.dataset.col === col) arrow.textContent = dir === 'asc' ? '↑' : '↓';
    else arrow.textContent = '↕';
  });
}

function sortAeTable(side, col) {
  const ss = state.sortState[side];
  if (ss.col === col) ss.dir = ss.dir === 'asc' ? 'desc' : 'asc';
  else { ss.col = col; ss.dir = col === 'count' ? 'desc' : 'asc'; }
  renderAeTable(side, state[`eventsData_${side}`]);
}

function drawChart(side, data) {
  if (state.chartInstances[side]) { state.chartInstances[side].destroy(); }
  const ctx = $(`chart-${side}`).getContext('2d');
  state.chartInstances[side] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(r => r.name),
      datasets: [{
        label: 'Reports',
        data: data.map(r => r.count),
        backgroundColor: '#2980B9',
        borderRadius: 3,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 11 } } },
        y: { ticks: { font: { size: 11 } } }
      }
    }
  });
}

/* ── Label & Warnings ────────────────────────────────── */
async function fetchLabel(side, drug) {
  try {
    const enc = encodeURIComponent(drug);
    // product_type filter ensures we only match actual pharmaceutical drugs
    const url = `${ENDPOINTS.label}?search=(openfda.brand_name:"${enc}"+openfda.generic_name:"${enc}")+AND+(product_type:"HUMAN+PRESCRIPTION+DRUG"+product_type:"HUMAN+OTC+DRUG")&limit=1`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) { setTabEmpty(side, 'label', `"${drug}" does not appear to be a pharmaceutical drug in the FDA database.`); return; }
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    renderLabel(side, data.results?.[0] || null, drug);
  } catch {
    setTabError(side, 'label', 'Unable to load data. Please try again.');
  }
}

const LABEL_FIELDS = [
  { key: 'warnings', title: 'Warnings' },
  { key: 'drug_interactions', title: 'Drug Interactions' },
  { key: 'contraindications', title: 'Contraindications' },
  { key: 'adverse_reactions', title: 'Adverse Reactions' },
];

function renderLabel(side, result, drug) {
  if (!result) { setTabEmpty(side, 'label', `No label data found for "${drug}".`); return; }
  const container = $(`tab-${side}-label`);
  let html = '';
  LABEL_FIELDS.forEach(({ key, title }) => {
    const val = result[key];
    if (!val) return;
    const text = Array.isArray(val) ? val.join('\n') : String(val);
    const cardId = `lc-${side}-${key}`;
    html += `
      <div class="label-card">
        <div class="label-card-title">${title}</div>
        <div class="label-card-body collapsed" id="${cardId}">${escHtml(text)}</div>
        <button class="read-more-btn" data-target="${cardId}">Read more</button>
      </div>`;
  });
  if (!html) { setTabEmpty(side, 'label', `No label fields available for "${drug}".`); return; }
  container.innerHTML = html;
  container.querySelectorAll('.read-more-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleReadMore(btn));
  });
}

function toggleReadMore(btn) {
  const body = $(btn.dataset.target);
  const collapsed = body.classList.toggle('collapsed');
  btn.textContent = collapsed ? 'Read more' : 'Show less';
}

/* ── Recall History ──────────────────────────────────── */
async function fetchRecalls(side, drug) {
  try {
    const url = `${ENDPOINTS.enforcement}?search=product_description:"${encodeURIComponent(drug)}"&limit=20&sort=recall_initiation_date:desc`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) { setTabEmpty(side, 'recalls', `No recalls on record for "${drug}".`, 'success'); return; }
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    renderRecalls(side, data.results || [], drug);
  } catch {
    setTabError(side, 'recalls', 'Unable to load data. Please try again.');
  }
}

function recallClass(classification) {
  if (!classification) return { cls: 'class-iii', badge: 'badge-iii', label: 'Class III' };
  const c = classification.toLowerCase();
  if (c.includes('i') && !c.includes('ii')) return { cls: 'class-i', badge: 'badge-i', label: 'Class I' };
  if (c.includes('ii') && !c.includes('iii')) return { cls: 'class-ii', badge: 'badge-ii', label: 'Class II' };
  return { cls: 'class-iii', badge: 'badge-iii', label: 'Class III' };
}

function formatDate(s) {
  if (!s || s.length < 8) return s || '';
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}

function renderRecalls(side, results, drug) {
  if (!results.length) { setTabEmpty(side, 'recalls', `No recalls on record for "${drug}".`, 'success'); return; }
  const container = $(`tab-${side}-recalls`);
  let html = `
    <div class="recall-legend">
      <span class="legend-item"><span class="legend-dot" style="background:var(--red)"></span>Class I — serious risk</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--amber)"></span>Class II — temporary risk</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--gray)"></span>Class III — unlikely harm</span>
    </div>`;
  results.forEach(r => {
    const { cls, badge, label } = recallClass(r.classification);
    html += `
      <div class="recall-card ${cls}">
        <div class="recall-header">
          <span class="recall-date">${formatDate(r.recall_initiation_date)}</span>
          <span class="recall-badge ${badge}">${label}</span>
        </div>
        <div class="recall-reason">${escHtml(r.reason_for_recall || 'Reason not specified')}</div>
        <div class="recall-firm">Recalling firm: ${escHtml(r.recalling_firm || 'Unknown')}</div>
      </div>`;
  });
  container.innerHTML = html;
}

/* ── Drug Interactions ───────────────────────────────── */
const ixSection = $('interaction-section');

async function loadInteractions(drugA, drugB) {
  ixSection.classList.remove('hidden');
  ixSection.innerHTML = `
    <div class="ix-header">
      <span>Drug Interactions</span>
      <span class="ix-drugs">${escHtml(drugA)} &amp; ${escHtml(drugB)}</span>
    </div>
    <div class="ix-body">
      <div class="ix-loading"><div class="spinner"></div>Checking for interactions…</div>
    </div>`;

  try {
    const [rxcuiA, rxcuiB] = await Promise.all([
      fetchRxCUI(drugA),
      fetchRxCUI(drugB),
    ]);

    if (!rxcuiA || !rxcuiB) {
      setIxError(`Could not identify one or both drugs in RxNorm. Try using the exact generic name.`);
      return;
    }

    const url = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxcuiA}+${rxcuiB}`;
    const res = await fetch(url);
    if (!res.ok) { setIxError('Unable to load interaction data. Please try again.'); return; }
    const data = await res.json();
    renderInteractions(data, drugA, drugB);
  } catch {
    setIxError('Unable to load interaction data. Please try again.');
  }
}

async function fetchRxCUI(drug) {
  try {
    const res = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drug)}&search=1`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.idGroup?.rxnormId?.[0] || null;
  } catch { return null; }
}

function renderInteractions(data, drugA, drugB) {
  const groups = data.fullInteractionTypeGroup || [];
  const pairs = [];

  groups.forEach(group => {
    const source = group.sourceName || 'Unknown';
    (group.fullInteractionType || []).forEach(fit => {
      (fit.interactionPair || []).forEach(pair => {
        pairs.push({
          severity: (pair.severity || 'unknown').toLowerCase(),
          description: pair.description || '',
          source,
        });
      });
    });
  });

  const headerHtml = `
    <div class="ix-header">
      <span>Drug Interactions</span>
      <span class="ix-drugs">${escHtml(drugA)} &amp; ${escHtml(drugB)}</span>
    </div>`;

  if (!pairs.length) {
    ixSection.innerHTML = headerHtml + `<div class="ix-body"><p class="ix-none">No known interactions found between these two drugs.</p></div>`;
    return;
  }

  // Sort: high → moderate → minor → unknown
  const sevOrder = { high: 0, moderate: 1, minor: 2, unknown: 3 };
  pairs.sort((a, b) => (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3));

  const worstSev = pairs[0].severity;
  const badgeClass = `sev-${worstSev}`;
  const badgeLabel = worstSev.charAt(0).toUpperCase() + worstSev.slice(1);
  const count = pairs.length;

  let bodyHtml = `
    <div class="ix-summary">
      <span>${count} interaction${count !== 1 ? 's' : ''} found</span>
      <span class="ix-severity-badge ${badgeClass}">Highest: ${badgeLabel}</span>
    </div>
    <div class="ix-list">`;

  pairs.forEach(p => {
    const sev = p.severity in sevOrder ? p.severity : 'unknown';
    const label = sev.charAt(0).toUpperCase() + sev.slice(1);
    bodyHtml += `
      <div class="ix-card sev-${sev}">
        <div class="ix-card-header">
          <span class="ix-severity-badge ${`sev-${sev}`}">${label}</span>
          <span class="ix-source">${escHtml(p.source)}</span>
        </div>
        <div class="ix-desc">${escHtml(p.description)}</div>
      </div>`;
  });

  bodyHtml += `</div>`;
  ixSection.innerHTML = headerHtml + `<div class="ix-body">${bodyHtml}</div>`;
}

function setIxError(msg) {
  const current = ixSection.querySelector('.ix-header')?.outerHTML || '';
  ixSection.querySelector('.ix-body').innerHTML = `<p class="ix-error">${escHtml(msg)}</p>`;
  // preserve header if present
  if (!current) {
    ixSection.innerHTML = `<div class="ix-body"><p class="ix-error">${escHtml(msg)}</p></div>`;
  } else {
    ixSection.querySelector('.ix-body').innerHTML = `<p class="ix-error">${escHtml(msg)}</p>`;
  }
}

/* ── Help / Modal ────────────────────────────────────── */
document.querySelectorAll('.help-icon').forEach(icon => {
  icon.addEventListener('click', e => {
    e.stopPropagation();
    const topic = icon.dataset.topic;
    const content = POPUP_CONTENT[topic];
    if (!content) return;
    modalTitle.textContent = content.title;
    modalBody.innerHTML = content.body;
    modalOverlay.classList.add('open');
  });
});

$('modal-close').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
function closeModal() { modalOverlay.classList.remove('open'); }

/* ── Utility ─────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
