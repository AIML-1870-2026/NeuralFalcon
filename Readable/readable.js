// ── STATE ────────────────────────────────────────────────────
let bg = { r: 255, g: 255, b: 255 };
let fg = { r: 0, g: 0, b: 0 };
let textSize = 18;
let currentVision = 'normal';

// ── PRESETS ──────────────────────────────────────────────────
const presets = [
  { name: 'Classic', bg: [255,255,255], fg: [0,0,0] },
  { name: 'Night',   bg: [18,18,18],   fg: [230,230,230] },
  { name: 'Sepia',   bg: [240,225,196], fg: [80,60,30] },
  { name: 'Ocean',   bg: [10,25,47],   fg: [135,206,235] },
  { name: 'Forest',  bg: [240,248,230], fg: [22,70,25] },
  { name: 'Amber',   bg: [255,248,220], fg: [100,50,0] },
  { name: 'Slate',   bg: [45,55,72],   fg: [203,213,224] },
  { name: 'Rose',    bg: [255,240,245], fg: [100,15,40] },
];

// ── VISION MATRICES ──────────────────────────────────────────
// LMS transform matrices for color vision deficiency simulation
const visionMatrices = {
  normal:       [[1,0,0],[0,1,0],[0,0,1]],
  protanopia:   [[0.567,0.433,0],[0.558,0.442,0],[0,0.242,0.758]],
  deuteranopia: [[0.625,0.375,0],[0.7,0.3,0],[0,0.3,0.7]],
  tritanopia:   [[0.95,0.05,0],[0,0.433,0.567],[0,0.475,0.525]],
  monochromacy: [[0.299,0.587,0.114],[0.299,0.587,0.114],[0.299,0.587,0.114]],
};

function applyVision(r, g, b, type) {
  const m = visionMatrices[type];
  return {
    r: Math.round(m[0][0]*r + m[0][1]*g + m[0][2]*b),
    g: Math.round(m[1][0]*r + m[1][1]*g + m[1][2]*b),
    b: Math.round(m[2][0]*r + m[2][1]*g + m[2][2]*b),
  };
}

// ── WCAG LUMINANCE ───────────────────────────────────────────
function sRGB(c) {
  c = c / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(r, g, b) {
  return 0.2126 * sRGB(r) + 0.7152 * sRGB(g) + 0.0722 * sRGB(b);
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── SYNC & RENDER ────────────────────────────────────────────
function getSimulatedColors() {
  const sbg = applyVision(bg.r, bg.g, bg.b, currentVision);
  const sfg = applyVision(fg.r, fg.g, fg.b, currentVision);
  return { sbg, sfg };
}

function update() {
  const { sbg, sfg } = getSimulatedColors();

  // Display area
  const da = document.getElementById('display-area');
  da.style.backgroundColor = `rgb(${sbg.r},${sbg.g},${sbg.b})`;
  da.style.color = `rgb(${sfg.r},${sfg.g},${sfg.b})`;
  document.getElementById('sample-text').style.fontSize = textSize + 'px';

  // Swatches (always show real colors)
  document.getElementById('bg-swatch').style.background = `rgb(${bg.r},${bg.g},${bg.b})`;
  document.getElementById('text-swatch').style.background = `rgb(${fg.r},${fg.g},${fg.b})`;

  // Contrast (calculated on simulated colors)
  const lumBg = luminance(sbg.r, sbg.g, sbg.b);
  const lumFg = luminance(sfg.r, sfg.g, sfg.b);
  const ratio = contrastRatio(lumBg, lumFg);

  document.getElementById('ratio-display').textContent = ratio.toFixed(2) + ':1';
  document.getElementById('lum-bg-display').textContent = lumBg.toFixed(3);
  document.getElementById('lum-text-display').textContent = lumFg.toFixed(3);

  // WCAG badges
  setBadge('badge-aa',       ratio >= 4.5, 'AA Normal (4.5:1)');
  setBadge('badge-aa-large', ratio >= 3,   'AA Large (3:1)');
  setBadge('badge-aaa',      ratio >= 7,   'AAA Normal (7:1)');
}

function setBadge(id, pass, label) {
  const el = document.getElementById(id);
  el.className = 'wcag-badge ' + (pass ? 'pass' : 'fail');
  el.innerHTML = `<span class="badge-label">${label}</span><span class="badge-status">${pass ? '✓ Pass' : '✗ Fail'}</span>`;
}

// ── SYNC SLIDERS & NUMBER INPUTS ─────────────────────────────
function syncPair(sliderId, numberId, obj, key) {
  const slider = document.getElementById(sliderId);
  const num    = document.getElementById(numberId);

  slider.addEventListener('input', () => {
    const v = parseInt(slider.value);
    obj[key] = v;
    num.value = v;
    update();
  });

  num.addEventListener('input', () => {
    let v = Math.max(0, Math.min(255, parseInt(num.value) || 0));
    obj[key] = v;
    slider.value = v;
    num.value = v;
    update();
  });
}

// Background
syncPair('r-bg', 'r-bg-n', bg, 'r');
syncPair('g-bg', 'g-bg-n', bg, 'g');
syncPair('b-bg', 'b-bg-n', bg, 'b');

// Text
syncPair('r-text', 'r-text-n', fg, 'r');
syncPair('g-text', 'g-text-n', fg, 'g');
syncPair('b-text', 'b-text-n', fg, 'b');

// Size
const sizeSlider = document.getElementById('size-slider');
const sizeNum    = document.getElementById('size-num');
sizeSlider.addEventListener('input', () => {
  textSize = parseInt(sizeSlider.value);
  sizeNum.value = textSize;
  update();
});
sizeNum.addEventListener('input', () => {
  textSize = Math.max(10, Math.min(72, parseInt(sizeNum.value) || 18));
  sizeSlider.value = textSize;
  sizeNum.value = textSize;
  update();
});

// ── VISION BUTTONS ───────────────────────────────────────────
function setControlsDisabled(disabled) {
  const ids = ['r-bg','g-bg','b-bg','r-bg-n','g-bg-n','b-bg-n',
               'r-text','g-text','b-text','r-text-n','g-text-n','b-text-n'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    el.disabled = disabled;
    el.style.opacity = disabled ? '0.4' : '1';
  });
  document.getElementById('vision-note').style.display = disabled ? 'block' : 'none';
}

document.querySelectorAll('.vision-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.vision-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentVision = btn.dataset.vision;
    setControlsDisabled(currentVision !== 'normal');
    update();
  });
});

// ── PRESETS ──────────────────────────────────────────────────
function applyPreset(p) {
  bg.r = p.bg[0]; bg.g = p.bg[1]; bg.b = p.bg[2];
  fg.r = p.fg[0]; fg.g = p.fg[1]; fg.b = p.fg[2];

  ['r-bg','g-bg','b-bg'].forEach((id, i) => { document.getElementById(id).value = p.bg[i]; });
  ['r-bg-n','g-bg-n','b-bg-n'].forEach((id, i) => { document.getElementById(id).value = p.bg[i]; });
  ['r-text','g-text','b-text'].forEach((id, i) => { document.getElementById(id).value = p.fg[i]; });
  ['r-text-n','g-text-n','b-text-n'].forEach((id, i) => { document.getElementById(id).value = p.fg[i]; });

  // Switch to normal vision when applying preset
  if (currentVision !== 'normal') {
    currentVision = 'normal';
    document.querySelectorAll('.vision-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-vision="normal"]').classList.add('active');
    setControlsDisabled(false);
  }
  update();
}

const grid = document.getElementById('preset-grid');
presets.forEach(p => {
  const btn = document.createElement('button');
  btn.className = 'preset-btn';
  btn.title = p.name;

  const preview = document.createElement('div');
  preview.className = 'preset-preview';
  preview.style.backgroundColor = `rgb(${p.bg.join(',')})`;
  preview.style.color = `rgb(${p.fg.join(',')})`;
  preview.textContent = 'Aa';

  const name = document.createElement('div');
  name.className = 'preset-name';
  name.textContent = p.name;

  btn.appendChild(preview);
  btn.appendChild(name);
  btn.addEventListener('click', () => applyPreset(p));
  grid.appendChild(btn);
});

// ── INIT ─────────────────────────────────────────────────────
update();
