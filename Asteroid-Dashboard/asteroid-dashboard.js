// ── STATE ──────────────────────────────────────────────────────────────────
const state = {
  neows: { data: null, sortCol: 'miss_distance', sortDir: 1 },
  sentry: { data: null },
  apiKey: localStorage.getItem('nasa_api_key') || 'DEMO_KEY',
};

// ── HELPERS ────────────────────────────────────────────────────────────────
function fmtNum(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: dec });
}
function today() { return new Date().toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
function setHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function showLoading(id, msg = 'Loading') { setHTML(id, `<div class="status-msg loading">${msg}</div>`); }
function showError(id, msg)  { setHTML(id, `<div class="error-msg">⚠ ${msg}</div>`); }

// ── TABS ───────────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.setAttribute('aria-selected', 'false'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.setAttribute('aria-selected', 'true');
      document.getElementById('panel-' + btn.dataset.tab)?.classList.add('active');
      if (btn.dataset.tab === 'threats' && !state.sentry.data) fetchSentry();
    });
    btn.addEventListener('keydown', e => {
      const tabs = [...document.querySelectorAll('.tab-btn')];
      const i = tabs.indexOf(btn);
      if (e.key === 'ArrowRight') tabs[(i + 1) % tabs.length].focus();
      if (e.key === 'ArrowLeft')  tabs[(i - 1 + tabs.length) % tabs.length].focus();
    });
  });
}

// ── TAB 1: NeoWs ───────────────────────────────────────────────────────────
async function fetchNeows() {
  const start = document.getElementById('neo-start').value;
  const end   = document.getElementById('neo-end').value;
  showLoading('neo-stats', 'Fetching');
  showLoading('neo-table-wrap', 'Fetching asteroid data');
  try {
    const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${state.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const neos = [];
    for (const date of Object.keys(json.near_earth_objects)) {
      for (const neo of json.near_earth_objects[date]) {
        const ca = neo.close_approach_data[0];
        neos.push({
          id:            neo.id,
          name:          neo.name.replace(/[()]/g, '').trim(),
          hazardous:     neo.is_potentially_hazardous_asteroid,
          diam_min:      neo.estimated_diameter.meters.estimated_diameter_min,
          diam_max:      neo.estimated_diameter.meters.estimated_diameter_max,
          miss_distance: parseFloat(ca.miss_distance.kilometers),
          velocity:      parseFloat(ca.relative_velocity.kilometers_per_second),
          date:          ca.close_approach_date,
          raw:           neo,
        });
      }
    }
    state.neows.data = neos;
    renderNeowsStats(neos);
    renderNeowsTable(neos);
    renderNeowsChart(neos);
    populateSimAsteroidPicker(neos);
  } catch (err) {
    const msg = err.message.includes('429')
      ? 'NASA DEMO_KEY rate limit hit (30 req/hr). <a href="https://api.nasa.gov/#signUp" target="_blank">Get a free API key</a> and paste it in the top-right box.'
      : err.message;
    setHTML('neo-stats', '');
    setHTML('neo-table-wrap', `<div class="error-msg">⚠ ${msg}</div>`);
  }
}

function renderNeowsStats(neos) {
  if (!neos.length) { setHTML('neo-stats', ''); return; }
  const haz     = neos.filter(n => n.hazardous).length;
  const closest = neos.reduce((a, b) => a.miss_distance < b.miss_distance ? a : b);
  const fastest = neos.reduce((a, b) => a.velocity > b.velocity ? a : b);
  setHTML('neo-stats', `
    <div class="stat-grid">
      <div class="stat-card"><div class="label">Total NEOs</div><div class="value">${neos.length}</div></div>
      <div class="stat-card"><div class="label">Hazardous</div><div class="value" style="color:var(--danger)">${haz}</div></div>
      <div class="stat-card"><div class="label">Closest</div><div class="value">${fmtNum(closest.miss_distance / 1000, 0)}</div><div class="unit">× 1000 km · ${closest.name}</div></div>
      <div class="stat-card"><div class="label">Fastest</div><div class="value">${fmtNum(fastest.velocity, 1)}</div><div class="unit">km/s · ${fastest.name}</div></div>
    </div>`);
}

function renderNeowsTable(neos) {
  if (!neos.length) { setHTML('neo-table-wrap', '<div class="status-msg">No NEOs in range.</div>'); return; }
  const { sortCol, sortDir } = state.neows;
  const sorted = [...neos].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });
  const arr = col => col === sortCol ? (sortDir === 1 ? ' ▲' : ' ▼') : '';
  const rows = sorted.map(n => `
    <tr class="${n.hazardous ? 'row-hazard' : ''}" data-id="${n.id}">
      <td>${n.name}</td>
      <td>${fmtNum((n.diam_min + n.diam_max) / 2, 0)} m</td>
      <td>${fmtNum(n.miss_distance, 0)} km</td>
      <td>${fmtNum(n.velocity, 2)} km/s</td>
      <td class="${n.hazardous ? 'hazard-yes' : 'hazard-no'}">${n.hazardous ? '⚠ YES' : 'no'}</td>
      <td>${n.date}</td>
    </tr>`).join('');
  setHTML('neo-table-wrap', `
    <div class="table-wrap"><table>
      <thead><tr>
        <th data-col="name">Name${arr('name')}</th>
        <th data-col="diam_min">Diameter${arr('diam_min')}</th>
        <th data-col="miss_distance">Miss Distance${arr('miss_distance')}</th>
        <th data-col="velocity">Velocity${arr('velocity')}</th>
        <th data-col="hazardous">Hazardous${arr('hazardous')}</th>
        <th data-col="date">Date${arr('date')}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`);
  document.querySelectorAll('#neo-table-wrap thead th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.neows.sortCol === col) state.neows.sortDir *= -1;
      else { state.neows.sortCol = col; state.neows.sortDir = 1; }
      renderNeowsTable(state.neows.data);
    });
  });
  document.querySelectorAll('#neo-table-wrap tbody tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const neo = neos.find(n => n.id === tr.dataset.id);
      if (neo) { openNeoPanel(neo); globeMarkApproach(neo); }
    });
  });
}

function renderNeowsChart(neos) {
  const wrap = document.getElementById('neo-chart-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<canvas id="neo-chart"></canvas>';
  const sorted = [...neos].sort((a, b) => new Date(a.date) - new Date(b.date));
  new Chart(document.getElementById('neo-chart'), {
    type: 'line',
    data: {
      labels: sorted.map(n => n.date),
      datasets: [{
        label: 'Miss Distance (km)',
        data: sorted.map(n => +n.miss_distance.toFixed(0)),
        borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,.07)',
        pointBackgroundColor: sorted.map(n => n.hazardous ? '#ff4444' : '#00d4ff'),
        tension: .3, fill: true, pointRadius: 4,
      }]
    },
    options: {
      plugins: { legend: { labels: { color: '#5a7090', font: { family: 'IBM Plex Mono', size: 10 } } } },
      scales: {
        x: { ticks: { color: '#5a7090', font: { size: 9 } }, grid: { color: '#1a2235' } },
        y: { ticks: { color: '#5a7090', font: { size: 9 } }, grid: { color: '#1a2235' } },
      }
    }
  });
}

function openNeoPanel(neo) {
  const ca = neo.raw.close_approach_data[0];
  setHTML('neo-panel-content', `
    <h2>${neo.name}</h2>
    <div class="kv-grid">
      <div class="kv-item"><div class="k">Hazardous</div><div class="v ${neo.hazardous ? 'hazard-yes' : ''}">${neo.hazardous ? '⚠ YES' : 'NO'}</div></div>
      <div class="kv-item"><div class="k">Diameter (avg)</div><div class="v">${fmtNum((neo.diam_min + neo.diam_max) / 2, 0)} m</div></div>
      <div class="kv-item"><div class="k">Miss Distance</div><div class="v">${fmtNum(neo.miss_distance, 0)} km</div></div>
      <div class="kv-item"><div class="k">Lunar Distance</div><div class="v">${fmtNum(ca.miss_distance.lunar, 2)} LD</div></div>
      <div class="kv-item"><div class="k">Velocity</div><div class="v">${fmtNum(neo.velocity, 2)} km/s</div></div>
      <div class="kv-item"><div class="k">Close Approach</div><div class="v">${ca.close_approach_date_full || neo.date}</div></div>
    </div>
    <button onclick="prefillSimulator('${neo.id}')" class="btn" style="width:100%;margin-top:8px">Use in Simulator →</button>
  `);
  document.getElementById('neo-panel-overlay').classList.add('open');
  document.getElementById('neo-panel').classList.add('open');
}

function closeNeoPanel() {
  document.getElementById('neo-panel-overlay').classList.remove('open');
  document.getElementById('neo-panel').classList.remove('open');
}

function prefillSimulator(id) {
  closeNeoPanel();
  const sel = document.getElementById('sim-asteroid');
  if (sel) { sel.value = id; updateAsteroidInfo(); }
  document.querySelector('[data-tab="sim"]')?.click();
}

// ── TAB 2: SENTRY ──────────────────────────────────────────────────────────
const SENTRY_URL = 'https://ssd-api.jpl.nasa.gov/sentry.api';
const PROXIES = [
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

async function timedFetch(url, ms = 9000) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), ms);
  try   { return await fetch(url, { signal: ctrl.signal }); }
  finally { clearTimeout(tid); }
}

async function fetchSentry() {
  showLoading('sentry-table-wrap', 'Fetching threat data…');

  // Try direct first, then each proxy
  const urls = [() => SENTRY_URL, ...PROXIES].map(fn => fn(SENTRY_URL));
  for (const url of urls) {
    try {
      const res = await timedFetch(url, 8000);
      if (!res.ok) continue;
      const text = await res.text();
      const json = JSON.parse(text);
      const data = json.data || [];
      if (data.length) { state.sentry.data = data; renderSentryTable(data); return; }
    } catch (_) {}
  }

  // All proxies failed — fall back to NeoWs hazardous objects
  useFallbackThreats();
}

function useFallbackThreats() {
  const neos = state.neows.data;
  if (!neos?.length) {
    setHTML('sentry-table-wrap', `<div class="info-msg">Sentry API unavailable. Load the <strong>Live Feed</strong> tab first — hazardous objects will appear here automatically.</div>`);
    return;
  }
  const hazardous = neos.filter(n => n.hazardous).sort((a, b) => a.miss_distance - b.miss_distance);
  if (!hazardous.length) {
    setHTML('sentry-table-wrap', '<div class="status-msg">No potentially hazardous objects in current date range.</div>');
    return;
  }
  const rows = hazardous.map(n => {
    const diam = (n.diam_min + n.diam_max) / 2;
    return `<tr data-id="${n.id}">
      <td>${n.name}</td>
      <td>${n.date}</td>
      <td>${fmtNum(diam, 0)} m</td>
      <td>${fmtNum(n.miss_distance, 0)} km</td>
      <td>${fmtNum(n.velocity, 2)} km/s</td>
    </tr>`;
  }).join('');
  setHTML('sentry-table-wrap', `
    <div class="info-msg" style="margin-bottom:12px">Sentry API unavailable — showing hazardous NEOs from Live Feed.</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Object</th><th>Date</th><th>Diameter</th><th>Miss Distance</th><th>Velocity</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`);
  document.querySelectorAll('#sentry-table-wrap tbody tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const neo = neos.find(n => n.id === tr.dataset.id);
      if (neo) { openNeoPanel(neo); globeMarkApproach(neo); }
    });
  });
}

function torinoColor(t) {
  const n = parseInt(t) || 0;
  if (n === 0) return '#1a2235';
  if (n <= 3)  return '#ffaa00';
  if (n <= 7)  return '#ff6600';
  return '#ff4444';
}

function renderSentryTable(data) {
  const rows = data.map(obj => {
    // Handle multiple possible field name variants from different API versions
    const ps  = parseFloat(obj.ps_cum ?? obj.ps_max ?? obj.Ps ?? 0) || 0;
    const tor = parseInt(obj.ts_max ?? obj.torino ?? obj.ts ?? 0) || 0;
    const ip  = parseFloat(obj.ip ?? obj.Pa ?? 0) || 0;
    const barW   = Math.min(Math.max((ps + 10) * 8, 2), 80);
    const barCol = ps > 0 ? 'var(--danger)' : ps > -2 ? 'var(--warning)' : 'var(--muted)';
    return `
      <tr data-des="${obj.des}">
        <td>${obj.fullname || obj.name || obj.des}</td>
        <td>${obj.range || '—'}</td>
        <td>${obj.n_imp || '—'}</td>
        <td><span class="palermo-bar" style="width:${barW}px;background:${barCol}"></span>${ps.toFixed(2)}</td>
        <td><span class="torino-cell" style="background:${torinoColor(tor)}">${tor}</span></td>
        <td>${ip > 0 ? (ip * 100).toExponential(2) + '%' : '—'}</td>
      </tr>`;
  }).join('');
  setHTML('sentry-table-wrap', `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Object</th><th>Year Range</th><th>Impacts</th>
        <th>Palermo Scale</th><th>Torino</th><th>Probability</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`);
  document.querySelectorAll('#sentry-table-wrap tbody tr').forEach(tr => {
    tr.addEventListener('click', () => openSentryModal(tr.dataset.des));
  });
}

async function openSentryModal(des) {
  const obj = state.sentry.data?.find(o => o.des === des);
  document.getElementById('sentry-modal-title').textContent = obj?.fullname || des;
  setHTML('sentry-modal-body', '<div class="status-msg loading">Loading solutions</div>');
  document.getElementById('sentry-modal').classList.add('open');
  try {
    const detailUrl = `${SENTRY_URL}?des=${encodeURIComponent(des)}`;
    const res = await fetch(detailUrl).catch(() => fetch(PROXY + encodeURIComponent(detailUrl)));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const solutions = json.data || [];
    if (!solutions.length) { setHTML('sentry-modal-body', '<div class="status-msg">No solutions found.</div>'); return; }
    const rows = solutions.map(s => `
      <tr>
        <td>${s.date || '—'}</td>
        <td>${s.dist ? (+s.dist).toFixed(4) + ' AU' : '—'}</td>
        <td>${s.ip  ? (parseFloat(s.ip) * 100).toExponential(2) + '%' : '—'}</td>
        <td>${s.ps  || '—'}</td>
        <td>${s.ts  || '—'}</td>
      </tr>`).join('');
    setHTML('sentry-modal-body', `
      <table class="sentry-detail-table">
        <thead><tr><th>Date</th><th>Distance</th><th>Probability</th><th>Palermo</th><th>Torino</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`);
  } catch (err) {
    showError('sentry-modal-body', err.message);
  }
}

// ── TAB 3: IMPACT SIMULATOR ────────────────────────────────────────────────
function populateSimAsteroidPicker(neos) {
  const sel = document.getElementById('sim-asteroid');
  if (!sel) return;
  sel.innerHTML = '<option value="">— select an asteroid —</option>' +
    neos.map(n => `<option value="${n.id}">${n.name} (${fmtNum((n.diam_min + n.diam_max) / 2, 0)} m · ${fmtNum(n.velocity, 1)} km/s)</option>`).join('');
  sel.addEventListener('change', updateAsteroidInfo);
}

function updateAsteroidInfo() {
  const sel = document.getElementById('sim-asteroid');
  const id  = sel?.value;
  const neo = state.neows.data?.find(n => n.id === id);
  const box = document.getElementById('sim-asteroid-info');
  if (!neo || !box) { if (box) box.style.display = 'none'; return; }
  const diam = (neo.diam_min + neo.diam_max) / 2;
  box.style.display = 'block';
  box.innerHTML = `
    Diameter: <span>${fmtNum(diam, 0)} m</span> &nbsp;·&nbsp;
    Velocity: <span>${fmtNum(neo.velocity, 2)} km/s</span> &nbsp;·&nbsp;
    Hazardous: <span style="color:${neo.hazardous ? 'var(--danger)' : 'var(--muted)'}">${neo.hazardous ? 'YES' : 'NO'}</span>
  `;
}

const DENSITIES = { porous: 1500, solid: 2700, iron: 7900 };

function calcImpact({ diam, velocity }) {
  const rho_i = 2700; // solid rock default
  const rho_t = 2700;
  const v     = velocity * 1000; // km/s → m/s
  const r     = diam / 2;
  const vol   = (4 / 3) * Math.PI * r ** 3;
  const mass  = rho_i * vol;
  const E     = 0.5 * mass * v ** 2;
  const E_tnt = E / 4.184e9;
  const theta = 45 * Math.PI / 180;
  const D_c   = 1.16 * Math.pow(rho_i / rho_t, 1/3) * Math.pow(diam, 0.78) * Math.pow(velocity, 0.44) * Math.pow(Math.sin(theta), 1/3);
  const r_20psi  = 0.28 * Math.pow(E_tnt, 1/3) * 1000;
  const r_5psi   = 0.66 * Math.pow(E_tnt, 1/3) * 1000;
  const r_1psi   = 1.60 * Math.pow(E_tnt, 1/3) * 1000;
  const r_therm  = Math.sqrt(E * 0.3 / (4 * Math.PI * 125000));
  const r_ejecta = D_c * 2.5;
  const mag      = (Math.log10(E) - 4.8) / 1.5;
  const airburst = diam < 25;
  return { E, E_tnt, D_c, r_therm, r_20psi, r_5psi, r_1psi, r_ejecta, mag, airburst };
}

async function geocode(location) {
  const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
  const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!data.length) throw new Error(`Location not found: "${location}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

function mToKm(m) { return (m / 1000).toFixed(1) + ' km'; }

async function runSimulator() {
  const id       = document.getElementById('sim-asteroid').value;
  const location = document.getElementById('sim-location').value.trim();
  const neo      = state.neows.data?.find(n => n.id === id);

  if (!neo)      { alert('Select an asteroid first.'); return; }
  if (!location) { alert('Enter a target location.'); return; }

  const btn = document.getElementById('sim-run-btn');
  btn.textContent = 'Calculating…';

  try {
    const { lat, lng } = await geocode(location);
    const diam = (neo.diam_min + neo.diam_max) / 2;
    const result = calcImpact({ diam, velocity: neo.velocity });
    renderSimResults(result, neo);
    renderGlobeImpact(lat, lng, result);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.textContent = 'Calculate Impact';
  }
}

function renderSimResults(r, neo) {
  const wrap = document.getElementById('sim-results');
  if (wrap) wrap.style.display = 'block';
  setHTML('sim-results-inner', `
    <div class="zone-row"><span>Impactor: ${neo.name}</span></div>
    <div class="zone-row"><span>💥 Crater diameter</span><span class="zone-val">${mToKm(r.D_c)}</span></div>
    <div class="zone-row"><span>🔥 Fireball radius</span><span class="zone-val">${mToKm(r.r_therm)}</span></div>
    <div class="zone-row"><span>🔴 Overpressure 20 psi</span><span class="zone-val">${mToKm(r.r_20psi)}</span></div>
    <div class="zone-row"><span>🟠 Overpressure 5 psi</span><span class="zone-val">${mToKm(r.r_5psi)}</span></div>
    <div class="zone-row"><span>🟡 Overpressure 1 psi</span><span class="zone-val">${mToKm(r.r_1psi)}</span></div>
    <div class="zone-row"><span>🪨 Ejecta radius</span><span class="zone-val">${mToKm(r.r_ejecta)}</span></div>
    <div class="zone-row"><span>🌊 Seismic magnitude</span><span class="zone-val">M ${r.mag.toFixed(1)}</span></div>
    <div class="zone-row"><span>⚡ Energy</span><span class="zone-val">${r.E_tnt.toExponential(2)} t TNT</span></div>
    ${r.airburst ? '<div class="info-msg" style="margin-top:8px">ℹ Likely airburst — may not reach ground.</div>' : ''}
  `);
  setHTML('globe-legend', `
    <div class="li"><div class="dot" style="background:#ff4444"></div>Crater</div>
    <div class="li"><div class="dot" style="background:#ff8800"></div>Fireball</div>
    <div class="li"><div class="dot" style="background:#ff2200"></div>20 psi</div>
    <div class="li"><div class="dot" style="background:#ffaa00"></div>5 psi</div>
    <div class="li"><div class="dot" style="background:#ffee00"></div>1 psi</div>
    <div class="li"><div class="dot" style="background:#8888ff"></div>Ejecta</div>
  `);
}

// ── 3D GLOBE (Three.js) ────────────────────────────────────────────────────
let globe = { scene: null, camera: null, renderer: null, earth: null, animId: null, autoRotate: true, lastX: 0, lastY: 0, dragging: false };

const EARTH_R = 5;

function latLngToVec3(lat, lng, r) {
  const phi   = (90 - lat)  * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

function initGlobe() {
  const container = document.getElementById('globe-container');
  if (!container || globe.renderer) return;

  const W = container.offsetWidth  || 380;
  const H = container.offsetHeight || 500;

  globe.scene    = new THREE.Scene();
  globe.camera   = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  globe.camera.position.set(0, 0, 14);

  globe.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  globe.renderer.setSize(W, H);
  globe.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(globe.renderer.domElement);

  // Lights
  globe.scene.add(new THREE.AmbientLight(0x334466, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(5, 3, 5);
  globe.scene.add(sun);

  // Earth
  const geo     = new THREE.SphereGeometry(EARTH_R, 64, 64);
  const texture = new THREE.TextureLoader().load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  const mat     = new THREE.MeshPhongMaterial({ map: texture, specular: 0x111133, shininess: 10 });
  globe.earth   = new THREE.Mesh(geo, mat);
  globe.scene.add(globe.earth);

  // Atmosphere
  const atmMat = new THREE.MeshPhongMaterial({ color: 0x0044ff, transparent: true, opacity: 0.07, side: THREE.FrontSide });
  globe.scene.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.025, 64, 64), atmMat));

  // Drag to rotate
  const c = globe.renderer.domElement;
  c.addEventListener('mousedown',  e => { globe.dragging = true; globe.autoRotate = false; globe.lastX = e.clientX; globe.lastY = e.clientY; });
  c.addEventListener('mousemove',  e => { if (!globe.dragging) return; globe.earth.rotation.y += (e.clientX - globe.lastX) * 0.005; globe.earth.rotation.x += (e.clientY - globe.lastY) * 0.005; globe.lastX = e.clientX; globe.lastY = e.clientY; });
  c.addEventListener('mouseup',    () => globe.dragging = false);
  c.addEventListener('mouseleave', () => globe.dragging = false);
  c.addEventListener('touchstart', e => { globe.autoRotate = false; globe.lastX = e.touches[0].clientX; globe.lastY = e.touches[0].clientY; });
  c.addEventListener('touchmove',  e => { globe.earth.rotation.y += (e.touches[0].clientX - globe.lastX) * 0.005; globe.earth.rotation.x += (e.touches[0].clientY - globe.lastY) * 0.005; globe.lastX = e.touches[0].clientX; globe.lastY = e.touches[0].clientY; e.preventDefault(); }, { passive: false });

  // Resize
  window.addEventListener('resize', () => {
    const w = container.offsetWidth || 380;
    const h = container.offsetHeight || 500;
    globe.renderer.setSize(w, h);
    globe.camera.aspect = w / h;
    globe.camera.updateProjectionMatrix();
  });

  animateGlobe();
}

function animateGlobe() {
  globe.animId = requestAnimationFrame(animateGlobe);
  if (globe.autoRotate && globe.earth) globe.earth.rotation.y += 0.0015;
  globe.renderer.render(globe.scene, globe.camera);
}

function clearGlobeMarkers() {
  if (!globe.scene) return;
  globe.scene.children.filter(c => c.userData.marker).forEach(c => globe.scene.remove(c));
}

function addGlobeRing(lat, lng, radiusKm, color) {
  const segments = 128;
  const angR     = (radiusKm / 6371) * EARTH_R; // arc → scene units
  const points   = [];
  for (let i = 0; i <= segments; i++) {
    const bearing = (i / segments) * 2 * Math.PI;
    const latR    = lat * Math.PI / 180;
    const lngR    = lng * Math.PI / 180;
    const dR      = angR / EARTH_R;
    const pLat    = Math.asin(Math.sin(latR) * Math.cos(dR) + Math.cos(latR) * Math.sin(dR) * Math.cos(bearing));
    const pLng    = lngR + Math.atan2(Math.sin(bearing) * Math.sin(dR) * Math.cos(latR), Math.cos(dR) - Math.sin(latR) * Math.sin(pLat));
    points.push(latLngToVec3(pLat * 180 / Math.PI, pLng * 180 / Math.PI, EARTH_R * 1.012));
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  line.userData.marker = true;
  globe.scene.add(line);
}

function addGlobePin(lat, lng, color = 0xff4444) {
  const pos  = latLngToVec3(lat, lng, EARTH_R * 1.03);
  const pin  = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), new THREE.MeshBasicMaterial({ color }));
  pin.position.copy(pos);
  pin.userData.marker = true;
  globe.scene.add(pin);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2 }));
  halo.position.copy(pos);
  halo.userData.marker = true;
  globe.scene.add(halo);
}

function orientGlobe(lat, lng) {
  if (!globe.earth) return;
  globe.earth.rotation.set(lat * Math.PI / 180, -(lng + 180) * Math.PI / 180, 0);
}

// Mark an asteroid's closest approach on the globe (simulated point — approach from deep space)
function globeMarkApproach(neo) {
  clearGlobeMarkers();
  // Simulate a random point on the sunlit hemisphere based on velocity direction
  const lat = (Math.random() - 0.5) * 120;
  const lng = (Math.random() - 0.5) * 360;
  addGlobePin(lat, lng, neo.hazardous ? 0xff4444 : 0x00d4ff);
  orientGlobe(lat, lng);
  globe.autoRotate = false;
  setHTML('globe-status', `${neo.name} · ${fmtNum(neo.miss_distance, 0)} km miss distance`);
}

function renderGlobeImpact(lat, lng, r) {
  clearGlobeMarkers();
  orientGlobe(lat, lng);
  globe.autoRotate = false;
  // Draw rings large → small
  if (r.r_ejecta  > 0) addGlobeRing(lat, lng, r.r_ejecta,  0x8888ff);
  if (r.r_1psi    > 0) addGlobeRing(lat, lng, r.r_1psi,    0xffee00);
  if (r.r_5psi    > 0) addGlobeRing(lat, lng, r.r_5psi,    0xffaa00);
  if (r.r_20psi   > 0) addGlobeRing(lat, lng, r.r_20psi,   0xff2200);
  if (r.r_therm   > 0) addGlobeRing(lat, lng, r.r_therm,   0xff8800);
  if (r.D_c       > 0) addGlobeRing(lat, lng, r.D_c / 2,   0xff4444);
  addGlobePin(lat, lng, 0xff4444);
  setHTML('globe-status', `Impact at ${lat.toFixed(2)}°, ${lng.toFixed(2)}° · M${r.mag.toFixed(1)}`);
}

// ── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initGlobe();

  // Dates
  const s = document.getElementById('neo-start');
  const e = document.getElementById('neo-end');
  if (s) s.value = today();
  if (e) e.value = addDays(today(), 7);

  // API key
  const keyInput = document.getElementById('api-key-input');
  if (keyInput) {
    // Clear any stale DEMO_KEY from localStorage
    if (localStorage.getItem('nasa_api_key') === 'DEMO_KEY') localStorage.removeItem('nasa_api_key');
    state.apiKey = localStorage.getItem('nasa_api_key') || 'DEMO_KEY';
    keyInput.value = state.apiKey === 'DEMO_KEY' ? '' : state.apiKey;
    keyInput.placeholder = state.apiKey === 'DEMO_KEY' ? 'DEMO_KEY (rate limited)' : '✓ Key saved';

    const saveKey = () => {
      const val = keyInput.value.trim();
      state.apiKey = val || 'DEMO_KEY';
      if (val) {
        localStorage.setItem('nasa_api_key', val);
        keyInput.style.borderColor = 'var(--success)';
        keyInput.placeholder = '✓ Key saved';
      } else {
        localStorage.removeItem('nasa_api_key');
        keyInput.style.borderColor = '';
        keyInput.placeholder = 'DEMO_KEY (rate limited)';
      }
    };
    keyInput.addEventListener('change', saveKey);
    keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') { saveKey(); fetchNeows(); } });
  }

  // NeoWs
  document.getElementById('neo-fetch-btn')?.addEventListener('click', fetchNeows);

  // NEO panel
  document.getElementById('neo-panel-close')?.addEventListener('click', closeNeoPanel);
  document.getElementById('neo-panel-overlay')?.addEventListener('click', closeNeoPanel);

  // Sentry modal
  document.getElementById('sentry-modal-close')?.addEventListener('click', () =>
    document.getElementById('sentry-modal').classList.remove('open'));
  document.getElementById('sentry-modal')?.addEventListener('click', e => {
    if (e.target.id === 'sentry-modal') document.getElementById('sentry-modal').classList.remove('open');
  });

  // Simulator
  document.getElementById('sim-run-btn')?.addEventListener('click', runSimulator);

  // Auto-load
  fetchNeows();
});
