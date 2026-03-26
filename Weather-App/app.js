// Weather App — app.js
const API_KEY = '3bf027658181fb4478c9016c8a41da9d';
const BASE    = 'https://api.openweathermap.org/data/2.5';

// ── State ──────────────────────────────────────────────────────
let unit = 'imperial'; // 'imperial' | 'metric'
let lastData = null;   // { current, forecast }

// ── DOM refs ───────────────────────────────────────────────────
const input       = document.getElementById('city-input');
const searchBtn   = document.getElementById('search-btn');
const errorMsg    = document.getElementById('error-msg');
const loading     = document.getElementById('loading');
const content     = document.getElementById('weather-content');
const unitBtn     = document.getElementById('unit-btn');

// ── Init ───────────────────────────────────────────────────────
const savedCity = localStorage.getItem('wx_last_city');
if (savedCity) {
  input.value = savedCity;
  fetchWeather(savedCity);
}

// ── Events ─────────────────────────────────────────────────────
searchBtn.addEventListener('click', onSearch);
input.addEventListener('keydown', e => { if (e.key === 'Enter') onSearch(); });
input.addEventListener('input', () => { errorMsg.textContent = ''; });
unitBtn.addEventListener('click', toggleUnit);

function onSearch() {
  const city = input.value.trim();
  if (!city) { showError('Please enter a city name.'); return; }
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

    if (curRes.status === 401 || fcRes.status === 401) {
      throw { code: 401 };
    }
    if (curRes.status === 404 || fcRes.status === 404) {
      throw { code: 404 };
    }
    if (!curRes.ok || !fcRes.ok) {
      throw { code: curRes.status || fcRes.status };
    }

    const [current, forecast] = await Promise.all([curRes.json(), fcRes.json()]);
    lastData = { current, forecast };
    localStorage.setItem('wx_last_city', current.name);
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
  const isDaytime = c.dt > c.sys.sunrise && c.dt < c.sys.sunset;
  const tempUnit  = unit === 'imperial' ? '°F' : '°C';
  const speedUnit = unit === 'imperial' ? 'mph' : 'm/s';

  document.getElementById('city-name').textContent =
    `${c.name}, ${c.sys.country}`;

  document.getElementById('date-time').textContent =
    formatDateTime(c.dt, c.timezone);

  document.getElementById('temperature').textContent =
    `${Math.round(c.main.temp)}${tempUnit}`;

  const icon = document.getElementById('weather-icon');
  icon.src = `https://openweathermap.org/img/wn/${c.weather[0].icon}@2x.png`;
  icon.alt = c.weather[0].description;

  document.getElementById('weather-desc').textContent =
    capitalize(c.weather[0].description);

  document.getElementById('feels-like').textContent =
    `Feels like ${Math.round(c.main.feels_like)}${tempUnit}`;

  document.getElementById('hi-lo').textContent =
    `H: ${Math.round(c.main.temp_max)}${tempUnit}  L: ${Math.round(c.main.temp_min)}${tempUnit}`;

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
      <img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="${day.desc}" width="40" height="40">
      <span class="fc-hi">${Math.round(day.hi)}${tempUnit}</span>
      <span class="fc-lo">${Math.round(day.lo)}${tempUnit}</span>
    `;
    container.appendChild(el);
  });
}

// ── Theme ──────────────────────────────────────────────────────
function applyTheme(c) {
  const isDaytime = c.dt > c.sys.sunrise && c.dt < c.sys.sunset;
  const cond = c.weather[0].main; // Clear, Clouds, Rain, etc.

  const themeMap = {
    Clear:        isDaytime ? 'theme-clear-day' : 'theme-clear-night',
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

  const newTheme = themeMap[cond] || 'theme-default';
  document.body.className = newTheme;
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
    if (key === todayKey) return; // skip today

    if (!map.has(key)) {
      map.set(key, { entries: [], label: weekdayLabel(entry.dt, tzOffset) });
    }
    map.get(key).entries.push(entry);
  });

  return Array.from(map.values()).map(day => {
    const noon = day.entries.find(e => e.dt_txt && e.dt_txt.includes('12:00:00'))
               || day.entries[Math.floor(day.entries.length / 2)];
    const hi = Math.max(...day.entries.map(e => e.main.temp_max));
    const lo = Math.min(...day.entries.map(e => e.main.temp_min));
    return {
      label: day.label,
      icon:  noon.weather[0].icon,
      desc:  noon.weather[0].description,
      hi, lo
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

// ── UI state helpers ───────────────────────────────────────────
function setLoading(on) {
  searchBtn.disabled = on;
  loading.classList.toggle('hidden', !on);
  if (on) content.classList.add('hidden');
}

function showError(msg) {
  errorMsg.textContent = msg;
}

function clearError() {
  errorMsg.textContent = '';
}

function handleError(err) {
  const messages = {
    401: 'Weather service unavailable. Please try later.',
    404: 'City not found. Please check the spelling and try again.',
  };
  const msg = messages[err.code] || (
    err instanceof TypeError
      ? 'Unable to reach weather service. Check your connection.'
      : 'Something went wrong. Please try again.'
  );
  showError(msg);
}
