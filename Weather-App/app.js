// Weather App — app.js
const API_KEY = '3bf027658181fb4478c9016c8a41da9d';
const BASE    = 'https://api.openweathermap.org/data/2.5';
const DEFAULT_CITY = 'New York';

// ── State ──────────────────────────────────────────────────────
let unit = 'imperial';
let lastData = null;
let activeChip = null;

// ── DOM refs ───────────────────────────────────────────────────
const input     = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const errorMsg  = document.getElementById('error-msg');
const loading   = document.getElementById('loading');
const content   = document.getElementById('weather-content');
const unitBtn   = document.getElementById('unit-btn');
const bgCanvas  = document.getElementById('bg-canvas');
const ctx       = bgCanvas.getContext('2d');

// ── Background particle system ─────────────────────────────────
let particles = [];
let particleType = 'none'; // 'stars' | 'rain' | 'snow' | 'none'
let animFrameId = null;

function resizeCanvas() {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function spawnParticles(type) {
  particleType = type;
  particles = [];
  if (type === 'none') return;

  const count = type === 'rain' ? 120 : type === 'snow' ? 60 : 80;
  for (let i = 0; i < count; i++) {
    particles.push(makeParticle(type, true));
  }
}

function makeParticle(type, random = false) {
  const w = bgCanvas.width, h = bgCanvas.height;
  if (type === 'stars') return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.5 + 0.3,
    a: Math.random(),
    da: (Math.random() - 0.5) * 0.008,
    vx: 0, vy: 0
  };
  if (type === 'rain') return {
    x: Math.random() * w,
    y: random ? Math.random() * h : -10,
    len: Math.random() * 18 + 8,
    speed: Math.random() * 8 + 10,
    a: Math.random() * 0.4 + 0.2
  };
  if (type === 'snow') return {
    x: Math.random() * w,
    y: random ? Math.random() * h : -10,
    r: Math.random() * 3 + 1.5,
    speed: Math.random() * 1.2 + 0.4,
    drift: (Math.random() - 0.5) * 0.6,
    a: Math.random() * 0.6 + 0.3
  };
}

function drawParticles() {
  ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  const w = bgCanvas.width, h = bgCanvas.height;

  // get particle color from CSS var
  const style = getComputedStyle(document.body);
  const rgb = style.getPropertyValue('--particle-color').trim() || '255,255,255';

  particles.forEach((p, i) => {
    if (particleType === 'stars') {
      p.a += p.da;
      if (p.a > 1) p.da = -Math.abs(p.da);
      if (p.a < 0) p.da = Math.abs(p.da);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},${Math.max(0,p.a)})`;
      ctx.fill();
    }
    else if (particleType === 'rain') {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 2, p.y + p.len);
      ctx.strokeStyle = `rgba(${rgb},${p.a})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      p.y += p.speed;
      if (p.y > h + 20) { Object.assign(p, makeParticle('rain')); }
    }
    else if (particleType === 'snow') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},${p.a})`;
      ctx.fill();
      p.y += p.speed;
      p.x += p.drift;
      if (p.y > h + 10) { Object.assign(p, makeParticle('snow')); }
    }
  });
}

function startAnim() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  function loop() {
    drawParticles();
    animFrameId = requestAnimationFrame(loop);
  }
  loop();
}

startAnim();

// ── City chips ─────────────────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const city = chip.dataset.city;
    input.value = city;
    setActiveChip(chip);
    fetchWeather(city);
  });
});

function setActiveChip(el) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
  if (el) el.classList.add('chip-active');
  activeChip = el;
}

function syncChipToCity(cityName) {
  const chips = document.querySelectorAll('.chip');
  let matched = null;
  chips.forEach(c => {
    if (c.dataset.city.toLowerCase() === cityName.toLowerCase()) matched = c;
  });
  setActiveChip(matched);
}

// ── Init ───────────────────────────────────────────────────────
const savedCity = localStorage.getItem('wx_last_city') || DEFAULT_CITY;
input.value = '';
fetchWeather(savedCity);

// ── Events ─────────────────────────────────────────────────────
searchBtn.addEventListener('click', onSearch);
input.addEventListener('keydown', e => { if (e.key === 'Enter') onSearch(); });
input.addEventListener('input', () => { errorMsg.textContent = ''; });
unitBtn.addEventListener('click', toggleUnit);

function onSearch() {
  const city = input.value.trim();
  if (!city) { showError('Please enter a city name.'); return; }
  setActiveChip(null);
  fetchWeather(city);
}

// ── Fetch ──────────────────────────────────────────────────────
async function fetchWeather(city) {
  setLoading(true);
  clearError();

  try {
    const [curRes, fcRes] = await Promise.all([
      fetch(`${BASE}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${unit}`),
      fetch(`${BASE}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${unit}`)
    ]);

    if (curRes.status === 401 || fcRes.status === 401) throw { code: 401 };
    if (curRes.status === 404 || fcRes.status === 404) throw { code: 404 };
    if (!curRes.ok || !fcRes.ok) throw { code: curRes.status || fcRes.status };

    const [current, forecast] = await Promise.all([curRes.json(), fcRes.json()]);
    lastData = { current, forecast };
    localStorage.setItem('wx_last_city', current.name);
    syncChipToCity(current.name);
    renderAll(current, forecast);
  } catch (err) {
    handleError(err);
  } finally {
    setLoading(false);
  }
}

// ── Render ─────────────────────────────────────────────────────
function renderAll(c, fc) {
  renderCurrent(c);
  renderForecast(fc, c);
  applyTheme(c);
  content.classList.remove('hidden');
}

function renderCurrent(c) {
  const tempUnit  = unit === 'imperial' ? '°F' : '°C';
  const speedUnit = unit === 'imperial' ? 'mph' : 'm/s';

  document.getElementById('city-name').textContent  = `${c.name}, ${c.sys.country}`;
  document.getElementById('date-time').textContent  = formatDateTime(c.dt, c.timezone);
  document.getElementById('temperature').textContent = `${Math.round(c.main.temp)}${tempUnit}`;

  const icon = document.getElementById('weather-icon');
  icon.src = `https://openweathermap.org/img/wn/${c.weather[0].icon}@2x.png`;
  icon.alt = c.weather[0].description;

  document.getElementById('weather-desc').textContent =
    capitalize(c.weather[0].description);
  document.getElementById('feels-like').textContent  =
    `Feels ${Math.round(c.main.feels_like)}${tempUnit}`;
  document.getElementById('hi-lo').textContent        =
    `↑${Math.round(c.main.temp_max)}  ↓${Math.round(c.main.temp_min)}${tempUnit}`;

  document.getElementById('humidity').textContent    = `${c.main.humidity}%`;
  document.getElementById('wind').textContent        = `${Math.round(c.wind.speed)} ${speedUnit}`;
  document.getElementById('visibility').textContent  =
    c.visibility != null ? `${(c.visibility / 1000).toFixed(1)} km` : '—';
  document.getElementById('sunrise').textContent = formatTime(c.sys.sunrise, c.timezone);
  document.getElementById('sunset').textContent  = formatTime(c.sys.sunset,  c.timezone);

  unitBtn.textContent = unit === 'imperial' ? '°F' : '°C';
}

function renderForecast(fc, current) {
  const container = document.getElementById('forecast-days');
  container.innerHTML = '';
  const tempUnit = unit === 'imperial' ? '°F' : '°C';
  const days = groupForecastByDay(fc.list, current.timezone);

  days.slice(0, 5).forEach(day => {
    const el = document.createElement('div');
    el.className = 'forecast-day';
    el.innerHTML = `
      <span class="day-label">${day.label}</span>
      <img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="${day.desc}" width="38" height="38">
      <span class="fc-hi">${Math.round(day.hi)}${tempUnit}</span>
      <span class="fc-lo">${Math.round(day.lo)}${tempUnit}</span>
    `;
    container.appendChild(el);
  });
}

// ── Theme + particles ──────────────────────────────────────────
function applyTheme(c) {
  const isDaytime = c.dt > c.sys.sunrise && c.dt < c.sys.sunset;
  const cond = c.weather[0].main;

  const themeMap = {
    Clear:        isDaytime ? 'theme-clear-day'   : 'theme-clear-night',
    Clouds:       'theme-clouds',
    Rain:         'theme-rain',
    Drizzle:      'theme-rain',
    Thunderstorm: 'theme-thunderstorm',
    Snow:         'theme-snow',
    Mist:         'theme-mist',
    Smoke:        'theme-mist',
    Haze:         'theme-mist',
    Dust:         'theme-mist',
    Fog:          'theme-mist',
    Sand:         'theme-mist',
    Ash:          'theme-mist',
    Squall:       'theme-rain',
    Tornado:      'theme-thunderstorm',
  };

  document.body.className = themeMap[cond] || 'theme-default';

  // spawn matching particles after theme applied (so CSS var is updated)
  requestAnimationFrame(() => {
    const pType = {
      'theme-clear-night':  'stars',
      'theme-default':      'stars',
      'theme-rain':         'rain',
      'theme-thunderstorm': 'rain',
      'theme-snow':         'snow',
    }[document.body.className] || 'none';
    spawnParticles(pType);
  });
}

// ── Unit toggle ────────────────────────────────────────────────
function toggleUnit() {
  unit = unit === 'imperial' ? 'metric' : 'imperial';
  if (lastData) renderAll(lastData.current, lastData.forecast);
}

// ── Helpers ────────────────────────────────────────────────────
function groupForecastByDay(list, tzOffset) {
  const map = new Map();
  const todayKey = dateKey(list[0].dt, tzOffset);

  list.forEach(entry => {
    const key = dateKey(entry.dt, tzOffset);
    if (key === todayKey) return;
    if (!map.has(key)) map.set(key, { entries: [], label: weekdayLabel(entry.dt, tzOffset) });
    map.get(key).entries.push(entry);
  });

  return Array.from(map.values()).map(day => {
    const noon = day.entries.find(e => e.dt_txt && e.dt_txt.includes('12:00:00'))
               || day.entries[Math.floor(day.entries.length / 2)];
    return {
      label: day.label,
      icon:  noon.weather[0].icon,
      desc:  noon.weather[0].description,
      hi: Math.max(...day.entries.map(e => e.main.temp_max)),
      lo: Math.min(...day.entries.map(e => e.main.temp_min))
    };
  });
}

function dateKey(unixSec, tzOffsetSec) {
  const d = new Date((unixSec + tzOffsetSec) * 1000);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function weekdayLabel(unixSec, tzOffsetSec) {
  const d = new Date((unixSec + tzOffsetSec) * 1000);
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()];
}

function formatTime(unixSec, tzOffsetSec) {
  const d = new Date((unixSec + tzOffsetSec) * 1000);
  let h = d.getUTCHours(), m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}

function formatDateTime(unixSec, tzOffsetSec) {
  const d = new Date((unixSec + tzOffsetSec) * 1000);
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let h = d.getUTCHours(), m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()} · ${h}:${String(m).padStart(2,'0')} ${ampm}`;
}

function capitalize(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// ── UI state ───────────────────────────────────────────────────
function setLoading(on) {
  searchBtn.disabled = on;
  loading.classList.toggle('hidden', !on);
  if (on) content.classList.add('hidden');
}

function showError(msg)  { errorMsg.textContent = msg; }
function clearError()    { errorMsg.textContent = ''; }

function handleError(err) {
  const messages = {
    401: 'Weather service unavailable. Please try later.',
    404: 'City not found. Please check the spelling and try again.',
  };
  showError(messages[err.code] || (
    err instanceof TypeError
      ? 'Unable to reach weather service. Check your connection.'
      : 'Something went wrong. Please try again.'
  ));
}
