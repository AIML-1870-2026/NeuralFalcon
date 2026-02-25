/* app.js — Main application logic, state management, UI wiring */

(function () {
  'use strict';

  // --- State ---
  const state = {
    color: { r: 79, g: 195, b: 247 },
    recentColors: JSON.parse(localStorage.getItem('rcs-recent') || '[]'),
    accessibleMode: localStorage.getItem('rcs-a11y') === 'true',
    currentPalette: [],
    currentPaletteName: '',
    history: [],
    historyIndex: -1
  };

  // --- DOM refs ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const sliderR = $('#sliderR'), sliderG = $('#sliderG'), sliderB = $('#sliderB');
  const valR = $('#valR'), valG = $('#valG'), valB = $('#valB');
  const hexInput = $('#hexInput');
  const studioSwatch = $('#studioSwatch');
  const colorName = $('#colorName');
  const hslToggle = $('#hslToggle');
  const hslInputs = $('#hslInputs');
  const hslH = $('#hslH'), hslS = $('#hslS'), hslL = $('#hslL');
  const a11yToggle = $('#a11yToggle');
  const a11yBanner = $('#a11yBanner');
  const toast = $('#toast');
  const srAnnounce = $('#srAnnounce');

  // --- Toast ---
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function announce(msg) {
    srAnnounce.textContent = msg;
  }

  // --- History (undo) ---
  function pushHistory() {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({ ...state.color });
    state.historyIndex = state.history.length - 1;
    if (state.history.length > 50) {
      state.history.shift();
      state.historyIndex--;
    }
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      const c = state.history[state.historyIndex];
      setColor(c.r, c.g, c.b, false);
    }
  }

  // --- Set color (central update) ---
  function setColor(r, g, b, addHistory = true) {
    r = Math.max(0, Math.min(255, Math.round(r)));
    g = Math.max(0, Math.min(255, Math.round(g)));
    b = Math.max(0, Math.min(255, Math.round(b)));

    if (addHistory && (r !== state.color.r || g !== state.color.g || b !== state.color.b)) {
      pushHistory();
    }

    state.color = { r, g, b };

    // Sliders
    sliderR.value = r; sliderG.value = g; sliderB.value = b;
    valR.textContent = r; valG.textContent = g; valB.textContent = b;

    // Slider gradient backgrounds
    sliderR.style.background = `linear-gradient(to right, rgb(0,${g},${b}), rgb(255,${g},${b}))`;
    sliderG.style.background = `linear-gradient(to right, rgb(${r},0,${b}), rgb(${r},255,${b}))`;
    sliderB.style.background = `linear-gradient(to right, rgb(${r},${g},0), rgb(${r},${g},255))`;

    // Hex
    const hex = ColorMath.rgbToHex(r, g, b);
    hexInput.value = hex.toUpperCase();

    // HSL
    const hsl = ColorMath.rgbToHsl(r, g, b);
    hslH.value = Math.round(hsl.h);
    hslS.value = Math.round(hsl.s * 100);
    hslL.value = Math.round(hsl.l * 100);

    // Swatch
    studioSwatch.style.backgroundColor = hex;
    const lum = WCAG.relativeLuminance(r, g, b);
    studioSwatch.style.color = lum > 0.4 ? '#000' : '#fff';

    // Color name
    colorName.textContent = ColorMath.nearestNamedColor(r, g, b);

    // Status bar
    $('#statusSwatch').style.backgroundColor = hex;
    $('#statusHex').textContent = hex.toUpperCase();
    $('#statusRgb').textContent = `rgb(${r}, ${g}, ${b})`;
    const wcagOnWhite = WCAG.contrastRatio(state.color, { r: 255, g: 255, b: 255 });
    const wcagOnBlack = WCAG.contrastRatio(state.color, { r: 0, g: 0, b: 0 });
    $('#statusWcag').textContent = `On white: ${wcagOnWhite.toFixed(2)}:1 | On black: ${wcagOnBlack.toFixed(2)}:1`;
    $('#statusName').textContent = ColorMath.nearestNamedColor(r, g, b);

    // Contrast checker fg sync
    $('#contrastFg').value = hex;
    $('#contrastFgSwatch').style.backgroundColor = hex;
    $('#contrastFgHex').textContent = hex.toUpperCase();

    // Update active views
    updateMixStrips();
    updateCube();
    updateContrastChecker();
    updateCloudPicker();
  }

  // --- Mix playground ---
  function updateMixStrips() {
    const mixA = $('#mixColorA');
    const mixB = $('#mixColorB');
    if (!mixA || !mixB) return;
    const hexA = mixA.value;
    const hexB = mixB.value;
    const cA = ColorMath.hexToRgb(hexA.replace('#', ''));
    const cB = ColorMath.hexToRgb(hexB.replace('#', ''));
    if (!cA || !cB) return;

    $('#mixSwatchA').style.backgroundColor = hexA;
    $('#mixSwatchB').style.backgroundColor = hexB;

    const steps = 16;
    const strips = [
      { el: '#mixStripRgb', fn: ColorMath.lerpRgb },
      { el: '#mixStripHsl', fn: ColorMath.lerpHsl },
      { el: '#mixStripOklch', fn: ColorMath.lerpOklch }
    ];

    strips.forEach(({ el, fn }) => {
      const container = $(el);
      container.innerHTML = '';
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const c = fn(cA, cB, t);
        const hex = ColorMath.rgbToHex(c.r, c.g, c.b);
        const div = document.createElement('div');
        div.className = 'mix-step';
        div.style.backgroundColor = hex;
        div.dataset.hex = hex;
        div.title = hex;
        div.addEventListener('click', () => {
          const rgb = ColorMath.hexToRgb(hex.replace('#', ''));
          if (rgb) setColor(rgb.r, rgb.g, rgb.b);
        });
        container.appendChild(div);
      }
    });
  }

  // --- RGB Cube ---
  let cubeRotX = -25, cubeRotY = 40, cubeDragging = false, cubeLastX, cubeLastY;

  function updateCube() {
    const cube = $('#rgbCube');
    if (!cube) return;
    const { r, g, b } = state.color;
    cube.style.transform = `rotateX(${cubeRotX}deg) rotateY(${cubeRotY}deg)`;

    const dot = $('#cubeDot');
    const size = 110;
    const half = 55;
    const x = (r / 255) * size;
    const y = (1 - g / 255) * size;
    const z = (b / 255) * size - half;
    const hex = ColorMath.rgbToHex(r, g, b);
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    dot.style.transform = `translate3d(-6px, -6px, ${z}px)`;
    dot.style.backgroundColor = hex;
    dot.style.color = hex;
  }

  function initCubeDrag() {
    const container = $('#cubeContainer');
    if (!container) return;
    container.addEventListener('pointerdown', (e) => {
      cubeDragging = true;
      cubeLastX = e.clientX;
      cubeLastY = e.clientY;
      container.setPointerCapture(e.pointerId);
    });
    container.addEventListener('pointermove', (e) => {
      if (!cubeDragging) return;
      cubeRotY += (e.clientX - cubeLastX) * 0.5;
      cubeRotX -= (e.clientY - cubeLastY) * 0.5;
      cubeLastX = e.clientX;
      cubeLastY = e.clientY;
      updateCube();
    });
    container.addEventListener('pointerup', () => { cubeDragging = false; });
  }

  // --- Contrast checker ---
  function updateContrastChecker() {
    const fgHex = $('#contrastFg').value;
    const bgHex = $('#contrastBg').value;
    const fg = ColorMath.hexToRgb(fgHex.replace('#', ''));
    const bg = ColorMath.hexToRgb(bgHex.replace('#', ''));
    if (!fg || !bg) return;

    $('#contrastFgSwatch').style.backgroundColor = fgHex;
    $('#contrastBgSwatch').style.backgroundColor = bgHex;
    $('#contrastFgHex').textContent = fgHex.toUpperCase();
    $('#contrastBgHex').textContent = bgHex.toUpperCase();

    const ratio = WCAG.contrastRatio(fg, bg);
    const apca = WCAG.apcaContrast(fg, bg);
    const level = WCAG.getLevel(ratio);

    $('#contrastRatioDisplay').textContent = ratio.toFixed(2) + ':1';
    $('#contrastApcaDisplay').textContent = 'APCA Lc: ' + apca.toFixed(1);

    // Badges
    const badges = $('#contrastBadges');
    badges.innerHTML = '';
    const checks = [
      { label: 'AA Normal (4.5:1)', pass: level.aaNormal },
      { label: 'AA Large (3:1)', pass: level.aaLarge },
      { label: 'AAA Normal (7:1)', pass: level.aaaNormal },
      { label: 'AAA Large (4.5:1)', pass: level.aaaLarge }
    ];
    checks.forEach(({ label, pass }) => {
      const span = document.createElement('span');
      span.className = 'contrast-badge ' + (pass ? 'pass' : 'fail');
      span.innerHTML = `<span class="badge-icon">${pass ? '&#10003;' : '&#10007;'}</span> ${label}`;
      badges.appendChild(span);
    });

    // Preview
    const preview = $('#contrastPreview');
    preview.style.backgroundColor = bgHex;
    preview.style.color = fgHex;
  }

  // --- Update accessibility panel palette data (no tab switch) ---
  function updateA11yPalette(colors, paletteName) {
    state.currentPalette = colors;
    state.currentPaletteName = paletteName;

    // Show the active palette banner
    const banner = $('#activePaletteBanner');
    banner.style.display = 'flex';
    $('#activePaletteName').textContent = paletteName;

    // Render mini preview swatches
    const preview = $('#activePalettePreview');
    preview.innerHTML = '';
    colors.forEach(c => {
      const div = document.createElement('div');
      div.className = 'mini-swatch';
      div.style.backgroundColor = ColorMath.rgbToHex(c.r, c.g, c.b);
      preview.appendChild(div);
    });

    // Re-render all a11y views if accessibility panel is already open
    if ($('#panel-a11y').classList.contains('active')) {
      renderPaletteAudit();
      renderCVD();
      renderMatrix();
    }
  }

  // --- Load palette into accessibility panel (with tab switch) ---
  function loadPaletteIntoA11y(colors, paletteName) {
    updateA11yPalette(colors, paletteName);

    // Switch to Accessibility tab
    switchToTab('tab-a11y');

    // Render all a11y views for this palette
    renderPaletteAudit();
    renderCVD();
    renderMatrix();

    announce(`Loaded ${paletteName} palette into accessibility checker`);
  }

  // --- Switch main tab programmatically ---
  function switchToTab(tabId) {
    const tabs = $$('.nav-tab');
    tabs.forEach(t => {
      t.setAttribute('aria-selected', 'false');
      const p = document.getElementById(t.getAttribute('aria-controls'));
      if (p) p.classList.remove('active');
    });
    const tab = document.getElementById(tabId);
    tab.setAttribute('aria-selected', 'true');
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (panel) panel.classList.add('active');
  }

  // --- Palette generation ---
  function renderPalettes() {
    const grid = $('#paletteGrid');
    grid.innerHTML = '';
    let firstPaletteLoaded = false;

    Object.entries(Palette.types).forEach(([key, info]) => {
      const colors = Palette.generate(key, state.color);
      const score = Palette.scorePalette(colors);

      const card = document.createElement('div');
      card.className = 'palette-card';
      card.innerHTML = `
        <div class="palette-card-header">
          <span class="palette-card-title">${info.name}</span>
          <span class="palette-score ${score >= 80 ? 'good' : score >= 50 ? 'ok' : 'bad'}">${score}% AA</span>
        </div>
        <div class="palette-card-desc">${info.desc}</div>
        <div class="palette-swatches"></div>
        <div class="palette-card-actions">
          <button class="check-a11y-btn" data-key="${key}">Check A11y ↗</button>
          <button class="export-css" data-key="${key}">Copy CSS</button>
          <button class="export-tw" data-key="${key}">Copy Tailwind</button>
        </div>
      `;

      // Auto-send to accessibility when hovering a palette card
      card.addEventListener('mouseenter', () => updateA11yPalette(colors, info.name));

      const swatchRow = card.querySelector('.palette-swatches');
      colors.forEach((c) => {
        const hex = ColorMath.rgbToHex(c.r, c.g, c.b);
        const btn = document.createElement('button');
        btn.className = 'palette-swatch';
        btn.style.backgroundColor = hex;
        btn.title = hex;
        btn.setAttribute('aria-label', `Color ${hex}`);

        // Accessible mode: mark non-compliant
        if (state.accessibleMode && !WCAG.passesAAOnWhiteOrBlack(c)) {
          btn.classList.add('non-compliant');
          btn.title += ' (Does not pass WCAG AA)';
        }

        // Hex label
        const lum = WCAG.relativeLuminance(c.r, c.g, c.b);
        const hexSpan = document.createElement('span');
        hexSpan.className = 'swatch-hex';
        hexSpan.style.color = lum > 0.4 ? '#000' : '#fff';
        hexSpan.textContent = hex;
        btn.appendChild(hexSpan);

        btn.addEventListener('click', () => setColor(c.r, c.g, c.b));
        swatchRow.appendChild(btn);
      });

      // Check A11y button — loads this palette into the accessibility panel
      card.querySelector('.check-a11y-btn').addEventListener('click', () => {
        loadPaletteIntoA11y(colors, info.name);
      });

      // Export buttons
      card.querySelector('.export-css').addEventListener('click', () => {
        const css = Palette.exportCSS(colors);
        navigator.clipboard.writeText(css).then(() => showToast('CSS variables copied'));
      });
      card.querySelector('.export-tw').addEventListener('click', () => {
        const tw = Palette.exportTailwind(colors);
        navigator.clipboard.writeText(tw).then(() => showToast('Tailwind config copied'));
      });

      grid.appendChild(card);

      // Auto-send first palette to accessibility on render
      if (!firstPaletteLoaded) {
        firstPaletteLoaded = true;
        updateA11yPalette(colors, info.name);
      }
    });
  }

  // --- CVD simulator ---
  function renderCVD() {
    const grid = $('#cvdGrid');
    grid.innerHTML = '';

    const palette = state.currentPalette.length > 0 ? state.currentPalette :
      Palette.generate('analogous', state.color);

    CVD.types.forEach(type => {
      const info = CVD.typeLabels[type];
      const score = CVD.safePaletteScore(palette, type);

      const card = document.createElement('div');
      card.className = 'cvd-card';
      card.innerHTML = `
        <div class="cvd-card-header">
          <span class="cvd-card-title">${info.name}</span>
          <span class="cvd-card-meta">${info.desc} (${info.prevalence})</span>
        </div>
        <div class="cvd-comparison">
          <div class="cvd-strip">
            <span class="cvd-strip-label">Original</span>
            <div class="cvd-swatch-row" id="cvd-orig-${type}"></div>
          </div>
          <div class="cvd-strip">
            <span class="cvd-strip-label">Simulated</span>
            <div class="cvd-swatch-row" id="cvd-sim-${type}"></div>
          </div>
        </div>
        <div class="cvd-safe-score">Safe palette score: <strong>${score}%</strong> pairs distinguishable</div>
      `;

      grid.appendChild(card);

      const origRow = card.querySelector(`#cvd-orig-${type}`);
      const simRow = card.querySelector(`#cvd-sim-${type}`);

      palette.forEach(c => {
        const origDiv = document.createElement('div');
        origDiv.className = 'cvd-swatch';
        origDiv.style.backgroundColor = ColorMath.rgbToHex(c.r, c.g, c.b);
        origRow.appendChild(origDiv);

        const sim = CVD.simulate(c, type);
        const simDiv = document.createElement('div');
        simDiv.className = 'cvd-swatch';
        simDiv.style.backgroundColor = ColorMath.rgbToHex(sim.r, sim.g, sim.b);
        simRow.appendChild(simDiv);
      });
    });
  }

  // --- Contrast matrix ---
  function renderMatrix() {
    const container = $('#matrixContainer');
    const palette = state.currentPalette.length > 0 ? state.currentPalette :
      Palette.generate('analogous', state.color);

    if (palette.length < 2) {
      container.innerHTML = '<p style="color:var(--text-muted)">Generate a palette first.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'contrast-matrix';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th></th>';
    palette.forEach(c => {
      const th = document.createElement('th');
      const swatch = document.createElement('span');
      swatch.className = 'header-swatch';
      swatch.style.backgroundColor = ColorMath.rgbToHex(c.r, c.g, c.b);
      th.appendChild(swatch);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    palette.forEach((rowC, i) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      const swatch = document.createElement('span');
      swatch.className = 'header-swatch';
      swatch.style.backgroundColor = ColorMath.rgbToHex(rowC.r, rowC.g, rowC.b);
      th.appendChild(swatch);
      tr.appendChild(th);

      palette.forEach((colC, j) => {
        const td = document.createElement('td');
        if (i === j) {
          td.className = 'self';
          td.textContent = '\u2014';
        } else {
          const ratio = WCAG.contrastRatio(rowC, colC);
          td.textContent = ratio.toFixed(1);
          td.title = `${ratio.toFixed(2)}:1 \u2014 ${ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large' : 'Fail'}`;
          if (ratio >= 7) td.className = 'ratio-aaa';
          else if (ratio >= 4.5) td.className = 'ratio-aa';
          else if (ratio >= 3) td.className = 'ratio-aa-large';
          else td.className = 'ratio-fail';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.innerHTML = '';
    container.appendChild(table);
  }

  // --- Palette Audit (per-swatch WCAG breakdown) ---
  function renderPaletteAudit() {
    const container = $('#paletteAudit');
    const palette = state.currentPalette.length > 0 ? state.currentPalette :
      Palette.generate('analogous', state.color);

    container.innerHTML = '';

    if (palette.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted)">No palette loaded. Hover a palette card or click Check A11y ↗.</p>';
      return;
    }

    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };

    palette.forEach((c) => {
      const hex = ColorMath.rgbToHex(c.r, c.g, c.b);
      const onWhite = WCAG.contrastRatio(c, white);
      const onBlack = WCAG.contrastRatio(c, black);
      const levW = WCAG.getLevel(onWhite);
      const levB = WCAG.getLevel(onBlack);

      const best = onWhite >= onBlack ? { ratio: onWhite, lev: levW, bg: '#ffffff', label: 'on white' }
                                      : { ratio: onBlack, lev: levB, bg: '#000000', label: 'on black' };

      const overallBadge = best.lev.aaaNormal ? 'AAA' : best.lev.aaNormal ? 'AA' : best.lev.aaLarge ? 'AA Large' : 'Fail';
      const overallClass = best.lev.aaNormal ? 'audit-pass' : best.lev.aaLarge ? 'audit-warn' : 'audit-fail';

      const row = document.createElement('div');
      row.className = 'audit-row';
      row.innerHTML = `
        <button class="audit-swatch" style="background:${hex}" title="Use ${hex}" aria-label="Select color ${hex}"></button>
        <div class="audit-info">
          <div class="audit-hex">${hex}</div>
          <div class="audit-name">${ColorMath.nearestNamedColor(c.r, c.g, c.b)}</div>
        </div>
        <div class="audit-scores">
          <div class="audit-score-pair">
            <span class="audit-score-label">on white</span>
            <span class="audit-ratio ${levW.aaNormal ? 'ratio-pass' : levW.aaLarge ? 'ratio-warn' : 'ratio-fail'}">${onWhite.toFixed(2)}:1</span>
            <span class="audit-level">${levW.aaaNormal ? 'AAA' : levW.aaNormal ? 'AA' : levW.aaLarge ? 'AA Lg' : 'Fail'}</span>
          </div>
          <div class="audit-score-pair">
            <span class="audit-score-label">on black</span>
            <span class="audit-ratio ${levB.aaNormal ? 'ratio-pass' : levB.aaLarge ? 'ratio-warn' : 'ratio-fail'}">${onBlack.toFixed(2)}:1</span>
            <span class="audit-level">${levB.aaaNormal ? 'AAA' : levB.aaNormal ? 'AA' : levB.aaLarge ? 'AA Lg' : 'Fail'}</span>
          </div>
        </div>
        <div class="audit-preview" style="background:${best.bg};color:${hex}">Aa</div>
        <span class="audit-badge ${overallClass}">${overallBadge}</span>
      `;

      row.querySelector('.audit-swatch').addEventListener('click', () => setColor(c.r, c.g, c.b));
      container.appendChild(row);
    });
  }

  // --- Recent colors ---
  function addToRecent(r, g, b) {
    const hex = ColorMath.rgbToHex(r, g, b);
    state.recentColors = state.recentColors.filter(h => h !== hex);
    state.recentColors.unshift(hex);
    if (state.recentColors.length > 12) state.recentColors.pop();
    localStorage.setItem('rcs-recent', JSON.stringify(state.recentColors));
    renderRecent();
  }

  function renderRecent() {
    const container = $('#recentColors');
    container.innerHTML = '';
    state.recentColors.forEach(hex => {
      const btn = document.createElement('button');
      btn.className = 'recent-swatch';
      btn.style.backgroundColor = hex;
      btn.title = hex;
      btn.setAttribute('role', 'listitem');
      btn.setAttribute('aria-label', `Recent color ${hex}`);
      btn.addEventListener('click', () => {
        const rgb = ColorMath.hexToRgb(hex.replace('#', ''));
        if (rgb) setColor(rgb.r, rgb.g, rgb.b);
      });
      container.appendChild(btn);
    });
  }

  // --- Global CVD simulation widget ---
  function initCVDWidget() {
    const btn = $('#cvdToggleBtn');
    const dropdown = $('#cvdDropdown');
    const label = $('#cvdCurrentLabel');

    const filterMap = {
      none:          '',
      protanopia:    'url(#cvd-protanopia)',
      deuteranopia:  'url(#cvd-deuteranopia)',
      tritanopia:    'url(#cvd-tritanopia)',
      achromatopsia: 'url(#cvd-achromatopsia)'
    };
    const labelMap = {
      none:          'Normal',
      protanopia:    'Protanopia',
      deuteranopia:  'Deuteranopia',
      tritanopia:    'Tritanopia',
      achromatopsia: 'Achromato.'
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dropdown.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });

    $$('.cvd-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const type = opt.dataset.cvd;
        $$('.cvd-option').forEach(o => {
          o.classList.remove('active');
          o.setAttribute('aria-selected', 'false');
        });
        opt.classList.add('active');
        opt.setAttribute('aria-selected', 'true');

        document.documentElement.style.filter = filterMap[type];
        label.textContent = labelMap[type];
        btn.classList.toggle('active', type !== 'none');

        dropdown.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        announce('Color vision simulation: ' + labelMap[type]);
      });
    });

    document.addEventListener('click', (e) => {
      if (!$('#cvdWidget').contains(e.target)) {
        dropdown.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // --- Cloud Rain Picker ---
  function updateRainCol(colId, value, color) {
    const col = $(`#${colId}`);
    if (!col) return;
    const maxDrops = 20;
    const target = Math.round((value / 255) * maxDrops);
    const current = col.children.length;
    if (Math.abs(current - target) < 2) {
      Array.from(col.children).forEach(d => { d.style.background = color; });
      return;
    }
    col.innerHTML = '';
    const zoneW = col.parentElement.offsetWidth || 70;
    for (let i = 0; i < target; i++) {
      const drop = document.createElement('div');
      drop.className = 'rain-drop';
      const h = 5 + Math.random() * 10;
      const x = 4 + Math.random() * Math.max(4, zoneW - 14);
      const dur = 0.5 + Math.random() * 0.9;
      drop.style.cssText = `left:${x}px;height:${h}px;background:${color};animation-duration:${dur}s;animation-delay:${-Math.random() * dur}s`;
      col.appendChild(drop);
    }
  }

  function updateCloudPicker() {
    const { r, g, b } = state.color;
    const hex = ColorMath.rgbToHex(r, g, b);
    const darkHex = ColorMath.rgbToHex(Math.round(r * 0.4), Math.round(g * 0.4), Math.round(b * 0.4));

    // Set CSS custom properties on the SVG — most reliable way to drive SVG fill from JS
    const svg = $('#cloudSvg');
    if (svg) {
      svg.style.setProperty('--cloud-light', hex);
      svg.style.setProperty('--cloud-dark', darkHex);
    }

    // Rain: vivid pure-channel colors, density proportional to each channel value
    updateRainCol('rainColR', r, '#ff4444');
    updateRainCol('rainColG', g, '#44cc66');
    updateRainCol('rainColB', b, '#4488ff');

    // Value labels
    const rv = $('#rainValR'); if (rv) rv.textContent = r;
    const gv = $('#rainValG'); if (gv) gv.textContent = g;
    const bv = $('#rainValB'); if (bv) bv.textContent = b;

    // Puddle shows mixed color
    const puddle = $('#rainPuddle');
    if (puddle) puddle.style.backgroundColor = hex;
  }

  function initCloudPicker() {
    ['R', 'G', 'B'].forEach(ch => {
      const zone = $(`#rainZone${ch}`);
      if (!zone) return;
      const key = ch.toLowerCase();
      let dragging = false, startY = 0, startVal = 0;

      function beginDrag(clientY) {
        dragging = true;
        startY = clientY;
        startVal = state.color[key];
      }
      function moveDrag(clientY) {
        if (!dragging) return;
        const dy = startY - clientY;
        const nv = Math.max(0, Math.min(255, Math.round(startVal + dy * 1.6)));
        setColor(
          key === 'r' ? nv : state.color.r,
          key === 'g' ? nv : state.color.g,
          key === 'b' ? nv : state.color.b
        );
      }

      zone.addEventListener('mousedown', (e) => { beginDrag(e.clientY); e.preventDefault(); });
      zone.addEventListener('touchstart', (e) => { beginDrag(e.touches[0].clientY); e.preventDefault(); }, { passive: false });
      window.addEventListener('mousemove', (e) => moveDrag(e.clientY));
      window.addEventListener('touchmove', (e) => { moveDrag(e.touches[0].clientY); }, { passive: true });
      window.addEventListener('mouseup', () => { dragging = false; });
      window.addEventListener('touchend', () => { dragging = false; });
    });

    updateCloudPicker();
  }

  // --- Tab navigation ---
  function initTabs(tabSelector) {
    const tabs = $$(tabSelector);
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const panelId = tab.getAttribute('aria-controls');
        // Deselect sibling tabs
        tabs.forEach(t => {
          t.setAttribute('aria-selected', 'false');
          const p = document.getElementById(t.getAttribute('aria-controls'));
          if (p) p.classList.remove('active');
        });
        // Select this
        tab.setAttribute('aria-selected', 'true');
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');

        // Trigger renders for lazy panels
        if (panelId === 'panel-palettes') renderPalettes();
        if (panelId === 'panel-a11y') { renderPaletteAudit(); renderCVD(); renderMatrix(); updateContrastChecker(); }
        if (panelId === 'sub-audit') renderPaletteAudit();
        if (panelId === 'sub-cvd') renderCVD();
        if (panelId === 'sub-matrix') renderMatrix();
        if (panelId === 'sub-contrast') updateContrastChecker();
      });
    });
  }

  // --- Accessible mode ---
  function setAccessibleMode(on) {
    state.accessibleMode = on;
    localStorage.setItem('rcs-a11y', on);
    a11yToggle.setAttribute('aria-pressed', on);
    a11yBanner.classList.toggle('active', on);
    announce(on ? 'Accessible palette mode enabled' : 'Accessible palette mode disabled');
    if ($('#panel-palettes').classList.contains('active')) renderPalettes();
  }

  // --- Event listeners ---
  function init() {
    // Slider input
    [sliderR, sliderG, sliderB].forEach(slider => {
      slider.addEventListener('input', () => {
        setColor(+sliderR.value, +sliderG.value, +sliderB.value);
      });
      slider.addEventListener('keydown', (e) => {
        if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowUp')) {
          e.preventDefault();
          slider.value = Math.min(255, +slider.value + 9);
          setColor(+sliderR.value, +sliderG.value, +sliderB.value);
        }
        if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowDown')) {
          e.preventDefault();
          slider.value = Math.max(0, +slider.value - 9);
          setColor(+sliderR.value, +sliderG.value, +sliderB.value);
        }
      });
    });

    // Add to recent on slider release
    [sliderR, sliderG, sliderB].forEach(slider => {
      slider.addEventListener('change', () => {
        addToRecent(state.color.r, state.color.g, state.color.b);
      });
    });

    // Hex input
    hexInput.addEventListener('input', () => {
      let val = hexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      const rgb = ColorMath.hexToRgb(val.replace('#', ''));
      if (rgb) {
        setColor(rgb.r, rgb.g, rgb.b);
        hexInput.classList.add('flash');
        setTimeout(() => hexInput.classList.remove('flash'), 300);
      }
    });
    hexInput.addEventListener('change', () => {
      addToRecent(state.color.r, state.color.g, state.color.b);
    });

    // HSL toggle
    hslToggle.addEventListener('click', () => {
      const shown = hslInputs.style.display !== 'none';
      hslInputs.style.display = shown ? 'none' : 'flex';
      hslToggle.setAttribute('aria-pressed', !shown);
      hslToggle.textContent = shown ? 'Show HSL' : 'Hide HSL';
    });

    // HSL inputs
    [hslH, hslS, hslL].forEach(inp => {
      inp.addEventListener('input', () => {
        const rgb = ColorMath.hslToRgb(+hslH.value, +hslS.value / 100, +hslL.value / 100);
        setColor(rgb.r, rgb.g, rgb.b);
      });
    });

    // Copy buttons
    $$('.copy-btn[data-format]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { r, g, b } = state.color;
        let text;
        switch (btn.dataset.format) {
          case 'hex': text = ColorMath.rgbToHex(r, g, b); break;
          case 'rgb': text = `rgb(${r}, ${g}, ${b})`; break;
          case 'hsl': {
            const h = ColorMath.rgbToHsl(r, g, b);
            text = `hsl(${Math.round(h.h)}, ${Math.round(h.s*100)}%, ${Math.round(h.l*100)}%)`;
            break;
          }
          case 'oklch': {
            const lch = ColorMath.rgbToOklch(r, g, b);
            text = `oklch(${lch.L.toFixed(3)} ${lch.C.toFixed(3)} ${lch.h.toFixed(1)})`;
            break;
          }
        }
        if (text) {
          navigator.clipboard.writeText(text).then(() => showToast(`Copied: ${text}`));
        }
      });
    });

    // Accessible mode toggle
    a11yToggle.addEventListener('click', () => setAccessibleMode(!state.accessibleMode));

    // Contrast checker inputs
    $('#contrastFg').addEventListener('input', updateContrastChecker);
    $('#contrastBg').addEventListener('input', updateContrastChecker);
    $('#swapWhite').addEventListener('click', () => { $('#contrastBg').value = '#ffffff'; updateContrastChecker(); });
    $('#swapBlack').addEventListener('click', () => { $('#contrastBg').value = '#000000'; updateContrastChecker(); });
    $('#swapColors').addEventListener('click', () => {
      const tmp = $('#contrastFg').value;
      $('#contrastFg').value = $('#contrastBg').value;
      $('#contrastBg').value = tmp;
      updateContrastChecker();
    });

    // Auto-suggest
    $('#suggestAccessible').addEventListener('click', () => {
      const fgHex = $('#contrastFg').value;
      const bgHex = $('#contrastBg').value;
      const fg = ColorMath.hexToRgb(fgHex.replace('#', ''));
      const bg = ColorMath.hexToRgb(bgHex.replace('#', ''));
      if (!fg || !bg) return;
      const suggested = WCAG.nearestAccessible(fg, bg, 4.5);
      const hex = ColorMath.rgbToHex(suggested.r, suggested.g, suggested.b);
      $('#contrastFg').value = hex;
      setColor(suggested.r, suggested.g, suggested.b);
      showToast('Suggested AA-passing color: ' + hex);
    });

    // Mix playground
    const mixA = $('#mixColorA');
    const mixB = $('#mixColorB');
    if (mixA) mixA.addEventListener('input', updateMixStrips);
    if (mixB) mixB.addEventListener('input', updateMixStrips);

    const exportMix = $('#exportMixCSS');
    if (exportMix) {
      exportMix.addEventListener('click', () => {
        const hexA = $('#mixColorA').value;
        const hexB = $('#mixColorB').value;
        const cA = ColorMath.hexToRgb(hexA.replace('#', ''));
        const cB = ColorMath.hexToRgb(hexB.replace('#', ''));
        if (!cA || !cB) return;
        const steps = 16;
        const colors = [];
        for (let i = 0; i <= steps; i++) {
          colors.push(ColorMath.lerpOklch(cA, cB, i / steps));
        }
        const css = Palette.exportCSS(colors, 'mix');
        navigator.clipboard.writeText(css).then(() => showToast('Mix CSS variables copied'));
      });
    }

    // Export matrix CSV
    $('#exportMatrixCSV').addEventListener('click', () => {
      const palette = state.currentPalette;
      if (palette.length < 2) return;
      let csv = ',' + palette.map(c => ColorMath.rgbToHex(c.r, c.g, c.b)).join(',') + '\n';
      palette.forEach((rowC, i) => {
        csv += ColorMath.rgbToHex(rowC.r, rowC.g, rowC.b);
        palette.forEach((colC, j) => {
          csv += ',' + (i === j ? '-' : WCAG.contrastRatio(rowC, colC).toFixed(2));
        });
        csv += '\n';
      });
      navigator.clipboard.writeText(csv).then(() => showToast('Matrix CSV copied'));
    });

    // Tabs
    initTabs('.nav-tab');
    initTabs('#panel-a11y .sub-tab');

    // CVD widget
    initCVDWidget();

    // Cloud Rain picker
    initCloudPicker();

    // Cube drag
    initCubeDrag();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === '?' || e.altKey) { /* allow */ } else return;
      }

      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAccessibleMode(!state.accessibleMode);
      }
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        switchToTab('tab-a11y');
        document.getElementById('subtab-contrast').click();
      }
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        sliderR.focus();
      }
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        switchToTab('tab-palettes');
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        $('#helpModal').classList.toggle('active');
      }
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === 'Escape') {
        $('#helpModal').classList.remove('active');
      }
    });

    // Help modal close
    $('#helpClose').addEventListener('click', () => $('#helpModal').classList.remove('active'));
    $('#helpModal').addEventListener('click', (e) => {
      if (e.target === $('#helpModal')) $('#helpModal').classList.remove('active');
    });

    // Init state
    if (state.accessibleMode) setAccessibleMode(true);
    renderRecent();
    setColor(state.color.r, state.color.g, state.color.b, false);
    pushHistory();

    // Render palettes (default view)
    renderPalettes();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
