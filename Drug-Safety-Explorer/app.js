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
      <p>These reports come from the FDA Adverse Event Reporting System (FAERS) — a database of voluntary safety reports submitted by patients, healthcare providers, and drug manufacturers.</p>
      <h4>How is it collected?</h4>
      <p>Anyone can submit a report to FDA MedWatch online or by phone. Healthcare professionals and manufacturers are legally required to report serious events; patients can report voluntarily.</p>
      <h4>What the color rating means</h4>
      <p><strong style="color:#C0392B">■ High</strong> — reaction appears in the top 50% of reports for this drug.<br>
         <strong style="color:#E67E22">■ Moderate</strong> — middle range of reported reactions.<br>
         <strong style="color:#7F8C8D">■ Low</strong> — reported less frequently relative to other reactions.</p>
      <h4>Why are popular drugs' numbers so high?</h4>
      <p>A drug taken by 50 million people will have far more FAERS reports than one taken by 50,000 — even if the rarer drug is actually more dangerous. <strong>Never compare raw counts between two drugs directly.</strong> Use this tool to understand the <em>pattern</em> of reactions for each drug, not to rank safety.</p>
      <h4>What it can tell you</h4>
      <p>Which types of reactions appear most often in reports for this drug. The bar chart shows relative frequency — useful for spotting which body systems are most affected.</p>
      <h4>What it cannot tell you</h4>
      <p>A report is <em>not</em> proof the drug caused the reaction. The same patient may have had other conditions or medications. Under-reporting is common — most real-world events are never submitted to FAERS.</p>
      <h4>Tip: the table is sortable</h4>
      <p>Click the <strong>Reaction</strong> or <strong>Reports</strong> column header to sort alphabetically or by count.</p>
    `
  },
  label: {
    title: 'About Label & Warnings',
    body: `
      <h4>What is this data?</h4>
      <p>This is the official FDA-approved drug label (also called the "prescribing information" or "package insert") — the legally binding document drug manufacturers must provide.</p>
      <h4>How is it collected?</h4>
      <p>Labels are reviewed and approved by the FDA before a drug reaches market. They are updated whenever significant new safety information emerges from clinical trials or post-market surveillance.</p>
      <h4>What the card colors mean</h4>
      <p><strong style="color:#C0392B">Red border</strong> — highest-priority safety information (warnings, contraindications). These represent situations where the drug should be used with extreme caution or avoided entirely.<br>
         <strong style="color:#E67E22">Amber border</strong> — important but generally manageable safety information (drug interactions, known adverse reactions).</p>
      <h4>What it can tell you</h4>
      <p>Official, FDA-reviewed safety information including which patients should not take the drug, what other drugs it interacts with, and what side effects have been observed in clinical trials.</p>
      <h4>What it cannot tell you</h4>
      <p>Labels are based on clinical trial populations and may not reflect every patient's experience. Rare or newly discovered effects may not yet be reflected.</p>
    `
  },
  recalls: {
    title: 'About Recall History',
    body: `
      <h4>What is this data?</h4>
      <p>These are FDA drug recall enforcement reports — formal actions taken when a product is removed from the market due to a safety concern or manufacturing problem.</p>
      <h4>How is it classified?</h4>
      <p><strong style="color:#C0392B">Class I (Red)</strong> — Most serious. Reasonable probability that using the product will cause serious harm or death. Example: contamination with a toxic substance.<br>
         <strong style="color:#E67E22">Class II (Amber)</strong> — May cause temporary or reversible adverse health effects. Remote probability of serious harm. Example: incorrect dosage labeling.<br>
         <strong style="color:#7F8C8D">Class III (Gray)</strong> — Unlikely to cause adverse health effects, but violates FDA regulations. Example: minor labeling errors.</p>
      <h4>What it can tell you</h4>
      <p>Whether a specific brand or formulation of this drug has been recalled, why, and how serious the concern was.</p>
      <h4>What it cannot tell you</h4>
      <p>Recalls apply to <em>specific lots or manufacturing runs</em> — not the entire drug. Seeing a recall does not mean the drug is inherently unsafe or that your current supply is affected.</p>
      <h4>What to do if you see a recall</h4>
      <ol style="padding-left:1.2em;margin-top:4px;">
        <li>Check the lot number on your bottle against the specific recall notice on <a href="https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts" target="_blank" rel="noopener">fda.gov/recalls</a>.</li>
        <li>If your lot is affected, stop using the product and contact your pharmacist.</li>
        <li>Do <strong>not</strong> stop a critical medication without consulting your healthcare provider first.</li>
      </ol>
    `
  },
  'co-events': {
    title: 'About Co-reported Adverse Events',
    body: `
      <h4>What is this data?</h4>
      <p>These are FDA FAERS reports where <em>both</em> drugs were listed as part of the same patient's medication regimen when an adverse event occurred.</p>
      <h4>How is it collected?</h4>
      <p>The same voluntary FAERS reporting system used for individual adverse events. Reports where both drugs appear together are filtered and the most common reactions are counted.</p>
      <h4>What the color rating means</h4>
      <p>The same relative scale as individual adverse events — red indicates the reaction appears in the top 30% of co-reports, amber in the middle range, gray less frequently.</p>
      <h4>What it can tell you</h4>
      <p>Which reactions have been most commonly reported when patients were taking both drugs together. This can highlight potential interaction signals worth discussing with a healthcare provider.</p>
      <h4>Important limitations</h4>
      <p>This is <em>not</em> a formal drug interaction database. Co-occurrence in a report does not mean the two drugs caused the reaction together. The patient may have had underlying conditions, other medications, or the reaction may have been unrelated to either drug. Always consult a pharmacist or physician about drug combinations.</p>
    `
  },
  'search-tips': {
    title: 'Search Tips',
    body: `
      <h4>Use generic names, not brand names</h4>
      <p>The FDA database indexes drugs by their <strong>generic (active ingredient) name</strong>, not the brand name. For best results:</p>
      <ul style="padding-left:1.2em;margin-top:4px;">
        <li>Use <strong>ibuprofen</strong> instead of Advil or Motrin</li>
        <li>Use <strong>atorvastatin</strong> instead of Lipitor</li>
        <li>Use <strong>sertraline</strong> instead of Zoloft</li>
        <li>Use <strong>metformin</strong> instead of Glucophage</li>
      </ul>
      <h4>Autocomplete suggestions</h4>
      <p>Start typing — the search field will suggest correct spellings from the RxNorm drug database after 4 characters. Use the arrow keys to navigate and Enter to select.</p>
      <h4>If you get no results</h4>
      <p>Try the generic name, check spelling, or search a simpler form (e.g. "acetaminophen" instead of "acetaminophen 500mg"). Some drugs have limited FDA reporting data.</p>
      <h4>Comparing similar drugs</h4>
      <p>This tool works best for comparing drugs in the same class — e.g. two NSAIDs (ibuprofen vs naproxen), two statins (atorvastatin vs simvastatin), or two antidepressants. The side-by-side view makes differences in reported reactions easy to spot.</p>
    `
  },
  'report-count': {
    title: 'How to Interpret Report Counts',
    body: `
      <h4>More reports ≠ more dangerous</h4>
      <p>A drug taken by tens of millions of people (like ibuprofen) will always accumulate more FAERS reports than a drug with a small patient population — even if the common drug is actually safer. <strong>Raw counts are not a measure of danger.</strong></p>
      <h4>What to look at instead</h4>
      <p>Focus on the <em>types</em> of reactions reported and how they distribute across body systems. A drug with 500,000 reports mostly about headache is a different picture than one with 10,000 reports mostly about liver failure.</p>
      <h4>The "High / Moderate / Low" rating</h4>
      <p>These ratings compare reactions <em>within the same drug</em> — they tell you which reactions are most commonly reported relative to each other for that drug. They do not compare across drugs.</p>
      <h4>Under-reporting</h4>
      <p>Studies suggest fewer than 10% of adverse events are ever reported to FAERS. The database captures signals, not complete statistics. A reaction not appearing here does not mean it cannot happen.</p>
    `
  },
  'label-warnings': {
    title: 'What are Warnings?',
    body: `
      <h4>Definition</h4>
      <p>Warnings describe serious risks that can occur with this drug — situations requiring close monitoring, dosage adjustment, or avoidance in certain patients.</p>
      <h4>Boxed Warnings ("Black Box")</h4>
      <p>The most serious FDA warning appears in a black box at the top of the label. It means the FDA has determined the risk is significant enough to warrant special attention from prescribers and patients.</p>
      <h4>What to do</h4>
      <p>Read warnings carefully before taking a medication. If a warning describes your personal health situation (e.g., kidney disease, pregnancy, age), discuss it with your doctor or pharmacist before starting the drug.</p>
    `
  },
  'label-interactions': {
    title: 'What are Drug Interactions?',
    body: `
      <h4>Definition</h4>
      <p>Drug interactions occur when two or more substances (drugs, foods, supplements) affect how a medication works in your body. The effect can be an increase or decrease in the drug's effectiveness, or new side effects.</p>
      <h4>Types of interactions</h4>
      <p><strong>Pharmacokinetic</strong> — One drug changes how your body absorbs, distributes, metabolizes, or excretes another (e.g., one drug slows liver enzymes that break down another, causing it to build up).<br>
         <strong>Pharmacodynamic</strong> — Two drugs have additive or opposing effects on the same body system (e.g., two blood-thinners taken together may increase bleeding risk).</p>
      <h4>What to do</h4>
      <p>Tell every healthcare provider about all medications you take, including over-the-counter drugs, vitamins, and herbal supplements. A pharmacist is the best resource for checking for interactions.</p>
    `
  },
  'label-contraindications': {
    title: 'What are Contraindications?',
    body: `
      <h4>Definition</h4>
      <p>A contraindication is a specific situation where a drug should <em>not</em> be used because the risk clearly outweighs any possible benefit.</p>
      <h4>Examples</h4>
      <p>A blood thinner may be contraindicated in patients with active bleeding. A drug processed by the liver may be contraindicated in patients with severe liver disease. Some drugs are contraindicated during pregnancy.</p>
      <h4>Absolute vs. Relative</h4>
      <p><strong>Absolute contraindication</strong> — The drug must not be used under any circumstances in this situation.<br>
         <strong>Relative contraindication</strong> — The drug should be used with caution and only if benefits outweigh risks; requires careful clinical judgment.</p>
      <h4>What to do</h4>
      <p>If a contraindication applies to you, tell your doctor. Do not stop a prescribed medication without consulting your healthcare provider first.</p>
    `
  },
  'label-adverse': {
    title: 'What are Adverse Reactions (Label)?',
    body: `
      <h4>Definition</h4>
      <p>This section lists side effects observed during clinical trials and post-market experience that are considered potentially related to the drug.</p>
      <h4>How is this different from FAERS?</h4>
      <p>Label adverse reactions went through clinical review — researchers determined there was a reasonable likelihood the drug contributed to these effects. FAERS reports are raw, unreviewed submissions where causation is unknown.</p>
      <h4>Frequency language</h4>
      <p>Labels often use standardized frequency terms: <strong>Very common</strong> (&gt;10% of patients), <strong>Common</strong> (1–10%), <strong>Uncommon</strong> (0.1–1%), <strong>Rare</strong> (&lt;0.1%).</p>
      <h4>What to do</h4>
      <p>If you experience a listed reaction, don't panic — most are manageable. Contact your healthcare provider if a side effect is severe, persistent, or concerns you.</p>
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
btnStart.addEventListener('click', () => {
  splash.classList.add('hidden');
  runComparison();
});

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

// RxNorm spelling suggestions — returns clean ingredient names only (e.g. "ibuprofen", not "ibuprofen 200 MG Oral Tablet")
async function fetchSuggestions(q, dropdown, input) {
  if (q.length < 4) { hideDropdown(dropdown); return; }
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) { hideDropdown(dropdown); return; }
    const data = await res.json();
    const list = (data.suggestionGroup?.suggestionList?.suggestion || []).slice(0, 6);
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

function countRating(count, max) {
  const pct = count / max;
  if (pct > 0.5) return { cls: 'rating-high',     dot: '●', label: 'High' };
  if (pct > 0.15) return { cls: 'rating-moderate', dot: '●', label: 'Moderate' };
  return              { cls: 'rating-low',          dot: '●', label: 'Low' };
}

function renderEvents(side, results, drug) {
  if (!results.length) { setTabEmpty(side, 'events', `No adverse event reports found for "${drug}".`); return; }

  const tableData = results.map(r => ({ name: r.term, count: r.count }));
  state[`eventsData_${side}`] = tableData;
  state.sortState[side] = { col: 'count', dir: 'desc' };

  const total = tableData.reduce((s, r) => s + r.count, 0);
  const top = tableData[0];
  const container = $(`tab-${side}-events`);
  container.innerHTML = `
    <div class="interpret-box">
      <strong>${total.toLocaleString()}</strong> adverse event reports found.
      Most frequently reported: <strong>${escHtml(top.name)}</strong> (${top.count.toLocaleString()} reports).
      <button class="interpret-help" onclick="showPopup('report-count')">Why is this number so high?</button>
      <button class="interpret-help" onclick="showPopup('events')">What does this mean?</button>
    </div>
    <div class="rating-legend">
      <span class="rating-high">● High</span>
      <span class="rating-moderate">● Moderate</span>
      <span class="rating-low">● Low</span>
      <span class="rating-note">— frequency relative to top reaction</span>
    </div>
    <div class="chart-wrap"><canvas id="chart-${side}" height="220"></canvas></div>
    <table class="ae-table" id="ae-table-${side}">
      <thead><tr>
        <th style="width:32px"></th>
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
  const max = Math.max(...sorted.map(r => r.count));
  tbody.innerHTML = sorted.map(r => {
    const { cls, dot, label } = countRating(r.count, max);
    return `<tr>
      <td><span class="rating-dot ${cls}" title="${label}">${dot}</span></td>
      <td>${escHtml(r.name)}</td>
      <td>${r.count.toLocaleString()}</td>
    </tr>`;
  }).join('');
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
    const url = `${ENDPOINTS.label}?search=openfda.generic_name:"${enc}"&limit=1`;
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
  { key: 'warnings',          title: 'Warnings',          sev: 'high',     popup: 'label-warnings' },
  { key: 'contraindications', title: 'Contraindications', sev: 'high',     popup: 'label-contraindications' },
  { key: 'drug_interactions', title: 'Drug Interactions', sev: 'moderate', popup: 'label-interactions' },
  { key: 'adverse_reactions', title: 'Adverse Reactions', sev: 'moderate', popup: 'label-adverse' },
];

function renderLabel(side, result, drug) {
  if (!result) { setTabEmpty(side, 'label', `No label data found for "${drug}".`); return; }
  const container = $(`tab-${side}-label`);
  const found = LABEL_FIELDS.filter(f => result[f.key]);
  if (!found.length) { setTabEmpty(side, 'label', `No label fields available for "${drug}".`); return; }

  const highCount = found.filter(f => f.sev === 'high').length;
  const interpretText = highCount > 0
    ? `${highCount} high-priority safety section${highCount > 1 ? 's' : ''} found (shown in red). Review carefully with your healthcare provider.`
    : `No high-priority warnings found in this label. Review all sections with your healthcare provider.`;

  let html = `
    <div class="interpret-box interpret-box--${highCount > 0 ? 'warn' : 'ok'}">
      ${escHtml(interpretText)}
      <button class="interpret-help" onclick="showPopup('label')">About this data</button>
    </div>`;

  found.forEach(({ key, title, sev, popup }) => {
    const val = result[key];
    const text = Array.isArray(val) ? val.join('\n') : String(val);
    const cardId = `lc-${side}-${key}`;
    html += `
      <div class="label-card label-card--${sev}">
        <div class="label-card-title">
          ${escHtml(title)}
          <button class="inline-help" onclick="showPopup('${popup}')" title="What is this?">?</button>
        </div>
        <div class="label-card-body collapsed" id="${cardId}">${escHtml(text)}</div>
        <button class="read-more-btn" data-target="${cardId}">Read more</button>
      </div>`;
  });

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

/* ── Co-reported Adverse Events (cross-drug) ─────────── */
const ixSection = $('interaction-section');

async function loadInteractions(drugA, drugB) {
  ixSection.classList.remove('hidden');
  setIxHtml(drugA, drugB, `<div class="ix-loading"><div class="spinner"></div>Analyzing co-reported events…</div>`);

  try {
    const encA = encodeURIComponent(drugA);
    const encB = encodeURIComponent(drugB);
    // FAERS: reports where BOTH drugs appear — shows reactions most often co-reported
    const url = `${ENDPOINTS.events}?search=patient.drug.medicinalproduct:"${encA}"+AND+patient.drug.medicinalproduct:"${encB}"&count=patient.reaction.reactionmeddrapt.exact&limit=10`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        setIxHtml(drugA, drugB, `<p class="ix-none">No co-reported adverse events found for this drug combination in the FDA database.</p>`);
      } else {
        setIxHtml(drugA, drugB, `<p class="ix-error">Unable to load data. Please try again.</p>`);
      }
      return;
    }
    const data = await res.json();
    renderCoEvents(drugA, drugB, data.results || []);
  } catch {
    setIxHtml(drugA, drugB, `<p class="ix-error">Unable to load data. Please try again.</p>`);
  }
}

function renderCoEvents(drugA, drugB, results) {
  if (!results.length) {
    setIxHtml(drugA, drugB, `<p class="ix-none">No co-reported adverse events found for this combination.</p>`);
    return;
  }
  const total = results.reduce((s, r) => s + r.count, 0);
  const top = results[0];
  const max = top.count;
  let body = `
    <div class="interpret-box" style="margin-bottom:12px">
      <strong>${total.toLocaleString()}</strong> reports found where patients were taking both drugs.
      Most common reaction: <strong>${escHtml(top.term)}</strong>.
      <button class="interpret-help" onclick="showPopup('co-events')">What does this mean?</button>
    </div>
    <div class="rating-legend">
      <span class="rating-high">● High</span>
      <span class="rating-moderate">● Moderate</span>
      <span class="rating-low">● Low</span>
      <span class="rating-note">— frequency relative to top reaction</span>
    </div>
    <table class="ae-table">
      <thead><tr><th style="width:32px"></th><th>Reaction</th><th>Reports</th></tr></thead>
      <tbody>`;
  results.forEach(r => {
    const { cls, dot, label } = countRating(r.count, max);
    body += `<tr>
      <td><span class="rating-dot ${cls}" title="${label}">${dot}</span></td>
      <td>${escHtml(r.term)}</td>
      <td>${r.count.toLocaleString()}</td>
    </tr>`;
  });
  body += `</tbody></table>`;
  setIxHtml(drugA, drugB, body);
}

function setIxHtml(drugA, drugB, bodyHtml) {
  ixSection.innerHTML = `
    <div class="ix-header">
      <span>Co-reported Adverse Events <button class="inline-help" onclick="showPopup('co-events')" title="What is this?">?</button></span>
      <span class="ix-drugs">${escHtml(drugA)} &amp; ${escHtml(drugB)}</span>
    </div>
    <div class="ix-body">${bodyHtml}</div>`;
}

/* ── Help / Modal ────────────────────────────────────── */
function showPopup(topic) {
  const content = POPUP_CONTENT[topic];
  if (!content) return;
  modalTitle.textContent = content.title;
  modalBody.innerHTML = content.body;
  modalOverlay.classList.add('open');
}
window.showPopup = showPopup; // expose for inline onclick handlers

document.querySelectorAll('.help-icon').forEach(icon => {
  icon.addEventListener('click', e => {
    e.stopPropagation();
    showPopup(icon.dataset.topic);
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
