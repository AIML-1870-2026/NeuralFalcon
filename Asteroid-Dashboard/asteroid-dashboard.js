// ── STATE ──────────────────────────────────────────────────────────────────
const state = {
  neows: { data: null, sortCol: 'miss_distance', sortDir: 1 },
  apiKey: localStorage.getItem('nasa_api_key') || 'DEMO_KEY',
};

// ── HELPERS ────────────────────────────────────────────────────────────────
function fmtNum(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function showLoading(id, msg = 'Loading') {
  setHTML(id, `<div class="status-msg loading">${msg}</div>`);
}

function showError(id, msg) {
  setHTML(id, `<div class="error-msg">⚠ ${msg}</div>`);
}

// ── TABS ───────────────────────────────────────────────────────────────────
function initTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    btn.addEventListener('keydown', e => {
      const tabs = [...document.querySelectorAll('.tab-btn')];
      const i = tabs.indexOf(btn);
      if (e.key === 'ArrowRight') tabs[(i + 1) % tabs.length].focus();
      if (e.key === 'ArrowLeft')  tabs[(i - 1 + tabs.length) % tabs.length].focus();
    });
  });
}

function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.setAttribute('aria-selected', b.dataset.tab === id ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'panel-' + id);
  });
}

// ── TAB 1: NeoWs ───────────────────────────────────────────────────────────
async function fetchNeows() {
  const start = document.getElementById('neo-start').value;
  const end   = document.getElementById('neo-end').value;
  const key   = state.apiKey;

  showLoading('neo-stats', 'Fetching');
  showLoading('neo-table-wrap', 'Fetching asteroid data');

  try {
    const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // Flatten all NEOs across all dates
    const neos = [];
    for (const date of Object.keys(json.near_earth_objects)) {
      for (const neo of json.near_earth_objects[date]) {
        const ca = neo.close_approach_data[0];
        neos.push({
          id:            neo.id,
          name:          neo.name,
          hazardous:     neo.is_potentially_hazardous_asteroid,
          diam_min:      neo.estimated_diameter.meters.estimated_diameter_min,
          diam_max:      neo.estimated_diameter.meters.estimated_diameter_max,
          miss_distance: parseFloat(ca.miss_distance.kilometers),
          velocity:      parseFloat(ca.relative_velocity.kilometers_per_hour),
          date:          ca.close_approach_date,
          raw:           neo,
        });
      }
    }

    state.neows.data = neos;
    renderNeowsStats(neos);
    renderNeowsTable(neos);
    renderNeowsChart(neos);
  } catch (err) {
    showError('neo-stats', err.message);
    showError('neo-table-wrap', err.message);
    if (err.message.includes('429') || err.message.includes('403')) {
      showError('neo-table-wrap',
        'Rate limit hit. <a href="https://api.nasa.gov/#signUp" target="_blank">Get a free NASA API key</a> and enter it above.');
    }
  }
}

function renderNeowsStats(neos) {
  if (!neos.length) { setHTML('neo-stats', '<div class="status-msg">No data.</div>'); return; }

  const hazCount  = neos.filter(n => n.hazardous).length;
  const closest   = neos.reduce((a, b) => a.miss_distance < b.miss_distance ? a : b);
  const fastest   = neos.reduce((a, b) => a.velocity > b.velocity ? a : b);

  setHTML('neo-stats', `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">Total NEOs</div>
        <div class="value">${neos.length}</div>
      </div>
      <div class="stat-card">
        <div class="label">Potentially Hazardous</div>
        <div class="value" style="color:var(--danger)">${hazCount}</div>
      </div>
      <div class="stat-card">
        <div class="label">Closest Approach</div>
        <div class="value">${fmtNum(closest.miss_distance / 1000, 1)}</div>
        <div class="unit">thousand km · ${closest.name}</div>
      </div>
      <div class="stat-card">
        <div class="label">Fastest Object</div>
        <div class="value">${fmtNum(fastest.velocity / 3600, 1)}</div>
        <div class="unit">km/s · ${fastest.name}</div>
      </div>
    </div>
  `);
}

function renderNeowsTable(neos) {
  if (!neos.length) { setHTML('neo-table-wrap', '<div class="status-msg">No NEOs in this range.</div>'); return; }

  const { sortCol, sortDir } = state.neows;
  const sorted = [...neos].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'string') av = av.toLowerCase(), bv = bv.toLowerCase();
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });

  const arrow = col => col === sortCol ? (sortDir === 1 ? '▲' : '▼') : '↕';

  const rows = sorted.map(n => `
    <tr class="${n.hazardous ? 'row-hazard' : ''}" data-id="${n.id}">
      <td>${n.name.replace(/[()]/g, '')}</td>
      <td>${fmtNum((n.diam_min + n.diam_max) / 2, 0)} m</td>
      <td>${fmtNum(n.miss_distance, 0)} km</td>
      <td>${fmtNum(n.velocity / 3600, 2)} km/s</td>
      <td class="${n.hazardous ? 'hazard-yes' : 'hazard-no'}">${n.hazardous ? '⚠ YES' : 'NO'}</td>
      <td>${n.date}</td>
    </tr>
  `).join('');

  setHTML('neo-table-wrap', `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th data-col="name">Name <span class="sort-arrow">${arrow('name')}</span></th>
            <th data-col="diam_min">Diameter <span class="sort-arrow">${arrow('diam_min')}</span></th>
            <th data-col="miss_distance">Miss Distance <span class="sort-arrow">${arrow('miss_distance')}</span></th>
            <th data-col="velocity">Velocity <span class="sort-arrow">${arrow('velocity')}</span></th>
            <th data-col="hazardous">Hazardous <span class="sort-arrow">${arrow('hazardous')}</span></th>
            <th data-col="date">Date <span class="sort-arrow">${arrow('date')}</span></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);

  // Sort click
  document.querySelectorAll('#neo-table-wrap thead th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.neows.sortCol === col) state.neows.sortDir *= -1;
      else { state.neows.sortCol = col; state.neows.sortDir = 1; }
      renderNeowsTable(state.neows.data);
    });
  });

  // Row click → side panel
  document.querySelectorAll('#neo-table-wrap tbody tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const neo = neos.find(n => n.id === tr.dataset.id);
      if (neo) openNeoPanel(neo);
    });
  });
}

function renderNeowsChart(neos) {
  const wrap = document.getElementById('neo-chart-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<canvas id="neo-chart"></canvas>';
  const sorted = [...neos].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sorted.map(n => n.date);
  const data   = sorted.map(n => +(n.miss_distance / 1000).toFixed(0));

  new Chart(document.getElementById('neo-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Miss Distance (×1000 km)',
        data,
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0,212,255,.08)',
        pointBackgroundColor: neos.map(n => n.hazardous ? '#ff4444' : '#00d4ff'),
        tension: .3,
        fill: true,
      }]
    },
    options: {
      plugins: { legend: { labels: { color: '#5a7090', font: { family: 'IBM Plex Mono', size: 11 } } } },
      scales: {
        x: { ticks: { color: '#5a7090', font: { size: 10 } }, grid: { color: '#1a2235' } },
        y: { ticks: { color: '#5a7090', font: { size: 10 } }, grid: { color: '#1a2235' } },
      }
    }
  });
}

// ── NEO SIDE PANEL ─────────────────────────────────────────────────────────
function openNeoPanel(neo) {
  const ca = neo.raw.close_approach_data[0];
  setHTML('neo-panel-content', `
    <h2>${neo.name.replace(/[()]/g, '')}</h2>
    <div class="kv-grid">
      <div class="kv-item"><div class="k">SPK ID</div><div class="v">${neo.raw.id}</div></div>
      <div class="kv-item"><div class="k">Hazardous</div><div class="v ${neo.hazardous ? 'hazard-yes' : ''}">${neo.hazardous ? '⚠ YES' : 'NO'}</div></div>
      <div class="kv-item"><div class="k">Diameter (min)</div><div class="v">${fmtNum(neo.diam_min, 1)} m</div></div>
      <div class="kv-item"><div class="k">Diameter (max)</div><div class="v">${fmtNum(neo.diam_max, 1)} m</div></div>
      <div class="kv-item"><div class="k">Miss Distance</div><div class="v">${fmtNum(neo.miss_distance, 0)} km</div></div>
      <div class="kv-item"><div class="k">Lunar Distance</div><div class="v">${fmtNum(ca.miss_distance.lunar, 2)} LD</div></div>
      <div class="kv-item"><div class="k">Velocity</div><div class="v">${fmtNum(neo.velocity / 3600, 2)} km/s</div></div>
      <div class="kv-item"><div class="k">Close Approach</div><div class="v">${ca.close_approach_date_full}</div></div>
      <div class="kv-item"><div class="k">Orbiting Body</div><div class="v">${ca.orbiting_body}</div></div>
    </div>
    <a href="https://www.nasa.gov/cgi-bin/viewer/app#/${neo.raw.id}" target="_blank">View on NASA ↗</a>
  `);
  document.getElementById('neo-panel-overlay').classList.add('open');
  document.getElementById('neo-panel').classList.add('open');
}

function closeNeoPanel() {
  document.getElementById('neo-panel-overlay').classList.remove('open');
  document.getElementById('neo-panel').classList.remove('open');
}

// ── TAB 2: SBDB ────────────────────────────────────────────────────────────
async function fetchSBDB() {
  const query = document.getElementById('sbdb-search').value.trim();
  if (!query) return;

  showLoading('sbdb-result', 'Looking up object');

  try {
    const url = `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(query)}&phys-par=true&close-approach=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    if (d.message) throw new Error(d.message);

    renderSBDB(d, query);
  } catch (err) {
    showError('sbdb-result', err.message.includes('not found') || err.message.includes('No')
      ? `No object found for "${query}". Try a designation like "433" (Eros) or "101955" (Bennu).`
      : err.message);
  }
}

function getSBDBParam(phys, name) {
  if (!phys) return null;
  const p = phys.find(x => x.name === name);
  return p ? p.value : null;
}

function getTaxoBadge(orbit) {
  if (!orbit) return '';
  const cls = orbit.class?.code || '';
  const map = { S: 'badge-s', C: 'badge-c', X: 'badge-x' };
  const color = map[cls[0]] || 'badge-default';
  return `<span class="badge ${color}">${cls}</span>`;
}

function renderSBDB(d, query) {
  const obj    = d.object || {};
  const orbit  = d.orbit || {};
  const phys   = d.phys_par || [];
  const ca     = d.close_approach_data || [];

  const diam   = getSBDBParam(phys, 'diameter');
  const albedo = getSBDBParam(phys, 'albedo');
  const rot    = getSBDBParam(phys, 'rot_per');
  const H      = getSBDBParam(phys, 'H');

  const oe = orbit.elements || [];
  const getEl = name => { const e = oe.find(x => x.name === name); return e ? (+e.value).toFixed(6) : '—'; };

  const timelineHTML = renderSBDBTimeline(ca);

  setHTML('sbdb-result', `
    <div class="object-card">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <h2>${obj.fullname || obj.name || query}</h2>
        ${getTaxoBadge(orbit)}
      </div>
      <div class="kv-grid">
        <div class="kv-item"><div class="k">SPK-ID</div><div class="v">${obj.spkid || '—'}</div></div>
        <div class="kv-item"><div class="k">NEO Kind</div><div class="v">${obj.neo ? 'YES' : 'NO'}</div></div>
        <div class="kv-item"><div class="k">Diameter</div><div class="v">${diam ? fmtNum(diam, 2) + ' km' : '—'}</div></div>
        <div class="kv-item"><div class="k">Albedo</div><div class="v">${albedo || '—'}</div></div>
        <div class="kv-item"><div class="k">Rotation Period</div><div class="v">${rot ? fmtNum(rot, 2) + ' h' : '—'}</div></div>
        <div class="kv-item"><div class="k">H (magnitude)</div><div class="v">${H || '—'}</div></div>
      </div>
    </div>

    <section>
      <div class="chart-wrap">
        <div class="label" style="margin-bottom:8px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Orbital Elements</div>
        <table class="orbital-table">
          <tr><td>Semi-major axis (a)</td><td>${getEl('a')} AU</td></tr>
          <tr><td>Eccentricity (e)</td><td>${getEl('e')}</td></tr>
          <tr><td>Inclination (i)</td><td>${getEl('i')}°</td></tr>
          <tr><td>Long. of Asc. Node (Ω)</td><td>${getEl('om')}°</td></tr>
          <tr><td>Arg. of Perihelion (ω)</td><td>${getEl('w')}°</td></tr>
          <tr><td>Mean Anomaly (M)</td><td>${getEl('ma')}°</td></tr>
        </table>
      </div>
    </section>

    ${ca.length ? `
    <section>
      <div class="label" style="margin-bottom:8px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">Close Approaches (${ca.length})</div>
      <div class="timeline-wrap">${timelineHTML}</div>
    </section>` : ''}

    <a href="https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(obj.spkid || obj.name)}" target="_blank">View on JPL SBDB ↗</a>
  `);
}

function renderSBDBTimeline(ca) {
  if (!ca.length) return '';
  const now = new Date();
  const events = ca.slice(0, 30); // limit to 30 for display

  const dots = events.map(e => {
    const distAU = (+e.dist).toFixed(4);
    const isPast = new Date(e.cd) < now;
    const color  = isPast ? 'var(--muted)' : 'var(--accent)';
    return `
      <div class="timeline-event" title="${e.cd}">
        <div class="ev-dist" style="color:${color}">${distAU} AU</div>
        <div class="dot" style="background:${color}"></div>
        <div class="ev-label">${e.cd.slice(0, 7)}</div>
      </div>
    `;
  }).join('<div style="flex:1;min-width:20px"></div>');

  return `<div class="timeline">${dots}</div>`;
}

// ── TAB 3: SENTRY ──────────────────────────────────────────────────────────
async function fetchSentry() {
  showLoading('sentry-table-wrap', 'Fetching Sentry impact data');
  try {
    const res = await fetch('https://ssd-api.jpl.nasa.gov/sentry.api');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    renderSentryTable(d.data || []);
  } catch (err) {
    showError('sentry-table-wrap', err.message);
  }
}

function torinoColor(t) {
  const n = parseInt(t) || 0;
  if (n === 0) return '#1a2235';
  if (n <= 3)  return '#ffaa00';
  if (n <= 7)  return '#ff6600';
  return '#ff4444';
}

function renderSentryTable(data) {
  if (!data.length) { setHTML('sentry-table-wrap', '<div class="status-msg">No objects tracked.</div>'); return; }

  const rows = data.map(obj => {
    const ps    = parseFloat(obj.ps_cum ?? obj.ps_max) || 0;
    const tor   = parseInt(obj.ts_max ?? obj.torino) || 0;
    const barW  = Math.min(Math.max((ps + 10) * 8, 2), 80);
    const barCol = ps > 0 ? 'var(--danger)' : ps > -2 ? 'var(--warning)' : 'var(--muted)';
    return `
      <tr data-des="${obj.des}" style="cursor:pointer">
        <td>${obj.fullname || obj.des}</td>
        <td>${obj.range || '—'}</td>
        <td>${obj.n_imp || '—'}</td>
        <td>
          <span class="palermo-bar" style="width:${barW}px;background:${barCol}"></span>
          ${ps.toFixed(2)}
        </td>
        <td>
          <span class="torino-cell" style="background:${torinoColor(tor)}">${tor}</span>
        </td>
        <td>${(parseFloat(obj.ip) * 100).toExponential(2)}%</td>
      </tr>
    `;
  }).join('');

  setHTML('sentry-table-wrap', `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Object</th>
            <th>Year Range</th>
            <th>Potential Impacts</th>
            <th>Palermo Scale</th>
            <th>Torino</th>
            <th>Impact Prob.</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);

  document.querySelectorAll('#sentry-table-wrap tbody tr').forEach(tr => {
    tr.addEventListener('click', () => openSentryModal(tr.dataset.des, data));
  });
}

async function openSentryModal(des, data) {
  const obj = data.find(o => o.des === des);
  document.getElementById('sentry-modal-title').textContent = obj?.fullname || des;
  setHTML('sentry-modal-body', '<div class="status-msg loading">Loading impact solutions</div>');
  document.getElementById('sentry-modal').classList.add('open');

  try {
    const res = await fetch(`https://ssd-api.jpl.nasa.gov/sentry.api?des=${encodeURIComponent(des)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    const solutions = d.data || [];

    if (!solutions.length) { setHTML('sentry-modal-body', '<div class="status-msg">No detailed solutions available.</div>'); return; }

    const rows = solutions.map(s => `
      <tr>
        <td>${s.date || '—'}</td>
        <td>${s.dist ? (+s.dist).toFixed(4) + ' AU' : '—'}</td>
        <td>${s.ip ? (parseFloat(s.ip) * 100).toExponential(2) + '%' : '—'}</td>
        <td>${s.ps || '—'}</td>
        <td>${s.ts || '—'}</td>
      </tr>
    `).join('');

    setHTML('sentry-modal-body', `
      <table class="sentry-detail-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Distance</th>
            <th>Impact Prob.</th>
            <th>Palermo</th>
            <th>Torino</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `);
  } catch (err) {
    showError('sentry-modal-body', err.message);
  }
}

// ── TAB 4: IMPACT CALCULATOR ───────────────────────────────────────────────
let leafletMap = null;
let impactLayers = [];

const DENSITIES = { porous: 1500, solid: 2700, iron: 7900 };
const TARGET_STRENGTHS = { sedimentary: 2e7, crystalline: 6e7, wet_soil: 5e6 };

function calcImpact({ diam, density, velocity, angle }) {
  const rho_i  = DENSITIES[density]     || 2700;
  const rho_t  = 2700;
  const v      = velocity * 1000;                          // km/s → m/s
  const theta  = angle * Math.PI / 180;
  const r      = diam / 2;
  const vol    = (4 / 3) * Math.PI * r ** 3;
  const mass   = rho_i * vol;

  // Kinetic energy (J)
  const E = 0.5 * mass * v ** 2;
  const E_tnt = E / 4.184e9;                              // tonnes TNT

  // Crater diameter (Collins et al. 2005)
  const D_c = 1.16 * Math.pow(rho_i / rho_t, 1/3) *
              Math.pow(diam, 0.78) * Math.pow(velocity, 0.44) *
              Math.pow(Math.sin(theta), 1/3);

  // Overpressure rings — simplified Hopf scaling from TNT equivalent
  // r = C * E^(1/3) where C depends on target psi level
  const r_20psi = 0.28 * Math.pow(E_tnt, 1/3) * 1000;   // m
  const r_5psi  = 0.66 * Math.pow(E_tnt, 1/3) * 1000;
  const r_1psi  = 1.60 * Math.pow(E_tnt, 1/3) * 1000;

  // Thermal radius (W/m² threshold for 3rd degree burns ~125,000 W/m²)
  const F_t    = 125000;
  const r_therm = Math.sqrt(E * 0.3 / (4 * Math.PI * F_t));  // 30% goes to thermal

  // Ejecta radius (rough: 5× crater radius)
  const r_ejecta = D_c * 2.5;

  // Seismic magnitude (Richter approx from energy)
  const mag = (Math.log10(E) - 4.8) / 1.5;

  // Airburst check — if diameter < ~25m, may not reach ground
  const airburst = diam < 25;

  return { E, E_tnt, D_c, r_therm, r_20psi, r_5psi, r_1psi, r_ejecta, mag, airburst };
}

async function geocode(location) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
  const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!data.length) throw new Error(`Location not found: "${location}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name };
}

function mToKm(m) { return (m / 1000).toFixed(1) + ' km'; }

const ZONE_COLORS = {
  fireball: '#ff8800',
  crater:   '#ff4444',
  p20:      '#ff2222',
  p5:       '#ffaa00',
  p1:       '#ffee00',
  ejecta:   '#8888ff',
};

async function runCalculator() {
  const location   = document.getElementById('calc-location').value.trim();
  const diam       = parseFloat(document.getElementById('calc-diam').value) || 100;
  const density    = document.getElementById('calc-density').value;
  const velocity   = parseFloat(document.getElementById('calc-velocity').value) || 17;
  const angle      = parseFloat(document.getElementById('calc-angle').value) || 45;
  const targetType = document.getElementById('calc-target').value;

  if (!location) { alert('Enter a location first.'); return; }

  document.getElementById('calc-run-btn').textContent = 'Calculating…';

  try {
    const { lat, lng } = await geocode(location);
    const result = calcImpact({ diam, density, velocity, angle, targetType });
    renderImpactMap(lat, lng, result);
    renderImpactResults(result);
    renderGlobe(lat, lng, result);
  } catch (err) {
    alert(err.message);
  } finally {
    document.getElementById('calc-run-btn').textContent = 'Calculate Impact';
  }
}

function renderImpactMap(lat, lng, r) {
  if (!leafletMap) {
    leafletMap = L.map('map', { zoomControl: true }).setView([lat, lng], 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', maxZoom: 19
    }).addTo(leafletMap);
  } else {
    leafletMap.setView([lat, lng], 8);
    impactLayers.forEach(l => leafletMap.removeLayer(l));
    impactLayers = [];
  }

  const addCircle = (radius, color, label) => {
    const c = L.circle([lat, lng], {
      radius, color, fillColor: color,
      fillOpacity: 0.12, weight: 1.5, opacity: 0.7
    }).addTo(leafletMap).bindPopup(`<b>${label}</b><br>${mToKm(radius)}`);
    impactLayers.push(c);
  };

  addCircle(r.r_ejecta,  ZONE_COLORS.ejecta,  'Ejecta fallout');
  addCircle(r.r_1psi,    ZONE_COLORS.p1,      'Overpressure 1 psi (windows)');
  addCircle(r.r_5psi,    ZONE_COLORS.p5,      'Overpressure 5 psi (buildings)');
  addCircle(r.r_20psi,   ZONE_COLORS.p20,     'Overpressure 20 psi (concrete)');
  addCircle(r.r_therm,   ZONE_COLORS.fireball,'Thermal / fireball');
  addCircle(r.D_c / 2,   ZONE_COLORS.crater,  'Crater radius');

  // Impact marker
  const marker = L.circleMarker([lat, lng], {
    radius: 6, color: '#fff', fillColor: '#ff4444', fillOpacity: 1, weight: 2
  }).addTo(leafletMap).bindPopup('Impact site');
  impactLayers.push(marker);
}

function renderImpactResults(r) {
  const wrap = document.getElementById('impact-results');
  if (!wrap) return;
  wrap.style.display = 'block';
  setHTML('impact-results-inner', `
    <div class="zone-row"><span class="zone-name">💥 Crater diameter</span><span class="zone-val">${mToKm(r.D_c)}</span></div>
    <div class="zone-row"><span class="zone-name">🔥 Fireball / thermal radius</span><span class="zone-val">${mToKm(r.r_therm)}</span></div>
    <div class="zone-row"><span class="zone-name">🔴 Overpressure 20 psi</span><span class="zone-val">${mToKm(r.r_20psi)}</span></div>
    <div class="zone-row"><span class="zone-name">🟠 Overpressure 5 psi</span><span class="zone-val">${mToKm(r.r_5psi)}</span></div>
    <div class="zone-row"><span class="zone-name">🟡 Overpressure 1 psi</span><span class="zone-val">${mToKm(r.r_1psi)}</span></div>
    <div class="zone-row"><span class="zone-name">🪨 Ejecta fallout radius</span><span class="zone-val">${mToKm(r.r_ejecta)}</span></div>
    <div class="zone-row"><span class="zone-name">🌊 Seismic magnitude</span><span class="zone-val">M ${r.mag.toFixed(1)}</span></div>
    <div class="zone-row"><span class="zone-name">⚡ Energy released</span><span class="zone-val">${r.E_tnt.toExponential(2)} t TNT</span></div>
    ${r.airburst ? '<div class="info-msg">ℹ Asteroid likely airbursts before reaching ground — surface crater may not form.</div>' : ''}
  `);
}

// ── TAB 4: 3D GLOBE (Three.js) ─────────────────────────────────────────────
let globeScene, globeCamera, globeRenderer, globeEarth, globeAnimId;
let globeDragging = false, globeLastX = 0, globeLastY = 0;
let globeAutoRotate = true;
const EARTH_RADIUS = 5;

function latLngToVec3(lat, lng, r) {
  const phi   = (90 - lat)  * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

// Convert km radius on Earth surface to globe ring radius in scene units
function kmToGlobeAngle(km) {
  const earthRadiusKm = 6371;
  return (km / earthRadiusKm) * EARTH_RADIUS;
}

function initGlobe() {
  const container = document.getElementById('globe-container');
  if (!container || globeRenderer) return;

  // container may be hidden; use parent width or fallback
  const W = container.parentElement?.clientWidth || 520;
  const H = 420;

  globeScene    = new THREE.Scene();
  globeCamera   = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  globeCamera.position.set(0, 0, 14);

  globeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  globeRenderer.setSize(W, H);
  globeRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(globeRenderer.domElement);

  // Ambient + directional light
  globeScene.add(new THREE.AmbientLight(0x334466, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(5, 3, 5);
  globeScene.add(sun);

  // Earth sphere with NASA Blue Marble texture
  const geo      = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
  const loader   = new THREE.TextureLoader();
  const texture  = loader.load(
    'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    () => globeRenderer.render(globeScene, globeCamera)
  );
  const mat = new THREE.MeshPhongMaterial({ map: texture, specular: 0x111133, shininess: 12 });
  globeEarth = new THREE.Mesh(geo, mat);
  globeScene.add(globeEarth);

  // Atmosphere glow
  const atmGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.025, 64, 64);
  const atmMat = new THREE.MeshPhongMaterial({
    color: 0x0044ff, transparent: true, opacity: 0.07, side: THREE.FrontSide
  });
  globeScene.add(new THREE.Mesh(atmGeo, atmMat));

  // Mouse drag to rotate
  const canvas = globeRenderer.domElement;
  canvas.addEventListener('mousedown', e => { globeDragging = true; globeAutoRotate = false; globeLastX = e.clientX; globeLastY = e.clientY; });
  canvas.addEventListener('mousemove', e => {
    if (!globeDragging) return;
    const dx = e.clientX - globeLastX;
    const dy = e.clientY - globeLastY;
    globeEarth.rotation.y += dx * 0.005;
    globeEarth.rotation.x += dy * 0.005;
    globeLastX = e.clientX; globeLastY = e.clientY;
  });
  canvas.addEventListener('mouseup',   () => globeDragging = false);
  canvas.addEventListener('mouseleave',() => globeDragging = false);

  // Touch drag
  canvas.addEventListener('touchstart', e => { globeAutoRotate = false; globeLastX = e.touches[0].clientX; globeLastY = e.touches[0].clientY; });
  canvas.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - globeLastX;
    const dy = e.touches[0].clientY - globeLastY;
    globeEarth.rotation.y += dx * 0.005;
    globeEarth.rotation.x += dy * 0.005;
    globeLastX = e.touches[0].clientX; globeLastY = e.touches[0].clientY;
    e.preventDefault();
  }, { passive: false });

  animateGlobe();
}

function animateGlobe() {
  globeAnimId = requestAnimationFrame(animateGlobe);
  if (globeAutoRotate && globeEarth) globeEarth.rotation.y += 0.0015;
  globeRenderer.render(globeScene, globeCamera);
}

function clearGlobeMarkers() {
  if (!globeScene) return;
  const toRemove = globeScene.children.filter(c => c.userData.impactMarker);
  toRemove.forEach(c => globeScene.remove(c));
}

function addGlobeRing(lat, lng, radiusKm, color) {
  const segments = 128;
  const ringR    = kmToGlobeAngle(radiusKm);
  const points   = [];

  for (let i = 0; i <= segments; i++) {
    const bearing = (i / segments) * 2 * Math.PI;
    const latR    = lat * Math.PI / 180;
    const lngR    = lng * Math.PI / 180;
    const dR      = ringR / EARTH_RADIUS; // angular radius in radians

    const pLat = Math.asin(Math.sin(latR) * Math.cos(dR) +
                           Math.cos(latR) * Math.sin(dR) * Math.cos(bearing));
    const pLng = lngR + Math.atan2(
      Math.sin(bearing) * Math.sin(dR) * Math.cos(latR),
      Math.cos(dR) - Math.sin(latR) * Math.sin(pLat)
    );

    points.push(latLngToVec3(pLat * 180 / Math.PI, pLng * 180 / Math.PI, EARTH_RADIUS * 1.01));
  }

  const geo  = new THREE.BufferGeometry().setFromPoints(points);
  const mat  = new THREE.LineBasicMaterial({ color, linewidth: 2, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(geo, mat);
  line.userData.impactMarker = true;
  globeScene.add(line);
}

function addGlobePin(lat, lng) {
  const pos    = latLngToVec3(lat, lng, EARTH_RADIUS * 1.03);
  const geo    = new THREE.SphereGeometry(0.08, 16, 16);
  const mat    = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  const pin    = new THREE.Mesh(geo, mat);
  pin.position.copy(pos);
  pin.userData.impactMarker = true;
  globeScene.add(pin);

  // Glow halo
  const hGeo = new THREE.SphereGeometry(0.18, 16, 16);
  const hMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.25 });
  const halo = new THREE.Mesh(hGeo, hMat);
  halo.position.copy(pos);
  halo.userData.impactMarker = true;
  globeScene.add(halo);
}

function orientGlobeTo(lat, lng) {
  if (!globeEarth) return;
  // Rotate earth so the impact point faces the camera
  globeEarth.rotation.y = -(lng + 180) * Math.PI / 180;
  globeEarth.rotation.x = lat * Math.PI / 180;
}

function renderGlobe(lat, lng, r) {
  const globeSection    = document.getElementById('globe-section');
  const globeContainer  = document.getElementById('globe-container');
  if (globeSection)   globeSection.style.display   = 'block';
  // Temporarily show container so Three.js can read dimensions
  if (globeContainer) globeContainer.style.display = 'block';

  initGlobe();
  clearGlobeMarkers();
  orientGlobeTo(lat, lng);

  // Draw rings large → small
  addGlobeRing(lat, lng, r.r_ejecta,  0x8888ff);
  addGlobeRing(lat, lng, r.r_1psi,    0xffee00);
  addGlobeRing(lat, lng, r.r_5psi,    0xffaa00);
  addGlobeRing(lat, lng, r.r_20psi,   0xff4400);
  addGlobeRing(lat, lng, r.r_therm,   0xff8800);
  if (r.D_c > 0) addGlobeRing(lat, lng, r.D_c / 2, 0xff4444);

  addGlobePin(lat, lng);
}

// ── GLOBE VIEW TOGGLE ──────────────────────────────────────────────────────
function initGlobeToggle() {
  const btn = document.getElementById('globe-toggle-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const mapEl   = document.getElementById('map');
    const globeEl = document.getElementById('globe-container');
    const showingGlobe = globeEl.style.display !== 'none';
    mapEl.style.display   = showingGlobe ? 'block' : 'none';
    globeEl.style.display = showingGlobe ? 'none'  : 'block';
    btn.textContent = showingGlobe ? '🌍 3D Globe' : '🗺 2D Map';
    // Resize renderer if globe is now visible
    if (!showingGlobe && globeRenderer) {
      const w = globeEl.clientWidth || 520;
      globeRenderer.setSize(w, 420);
      globeCamera.aspect = w / 420;
      globeCamera.updateProjectionMatrix();
    }
  });
}

// ── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();

  // Set default dates
  const startEl = document.getElementById('neo-start');
  const endEl   = document.getElementById('neo-end');
  if (startEl) startEl.value = today();
  if (endEl)   endEl.value   = addDays(today(), 7);

  // Fetch button
  document.getElementById('neo-fetch-btn')?.addEventListener('click', fetchNeows);

  // API key input
  const keyInput = document.getElementById('api-key-input');
  if (keyInput) {
    keyInput.value = state.apiKey === 'DEMO_KEY' ? '' : state.apiKey;
    keyInput.addEventListener('change', () => {
      const val = keyInput.value.trim();
      state.apiKey = val || 'DEMO_KEY';
      localStorage.setItem('nasa_api_key', state.apiKey);
    });
  }

  // Close panel
  document.getElementById('neo-panel-close')?.addEventListener('click', closeNeoPanel);
  document.getElementById('neo-panel-overlay')?.addEventListener('click', closeNeoPanel);

  // Globe toggle
  initGlobeToggle();

  // Calculator
  document.getElementById('calc-run-btn')?.addEventListener('click', runCalculator);
  const angleSlider = document.getElementById('calc-angle');
  const angleVal    = document.getElementById('calc-angle-val');
  angleSlider?.addEventListener('input', () => { if (angleVal) angleVal.textContent = angleSlider.value + '°'; });

  // Tab switch → lazy-load Sentry
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'sentry' && !document.getElementById('sentry-table-wrap').dataset.loaded) {
        document.getElementById('sentry-table-wrap').dataset.loaded = '1';
        fetchSentry();
      }
    });
  });

  // Sentry modal close
  document.getElementById('sentry-modal-close')?.addEventListener('click', () =>
    document.getElementById('sentry-modal').classList.remove('open'));
  document.getElementById('sentry-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('sentry-modal'))
      document.getElementById('sentry-modal').classList.remove('open');
  });

  // SBDB search
  document.getElementById('sbdb-search-btn')?.addEventListener('click', fetchSBDB);
  document.getElementById('sbdb-search')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') fetchSBDB();
  });

  // Auto-fetch on load
  fetchNeows();
});
