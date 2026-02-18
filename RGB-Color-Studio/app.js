/* app.js — Main application logic, state management, UI wiring */

(function () {
  'use strict';

  // --- State ---
  const state = {
    color: { r: 79, g: 195, b: 247 },
    recentColors: JSON.parse(localStorage.getItem('rcs-recent') || '[]'),
    accessibleMode: localStorage.getItem('rcs-a11y') === 'true',
    currentPalette: [], // most recently generated palette for matrix/CVD
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
    updateWaveform();
    updateMixStrips();
    updateCube();
    updateContrastChecker();
  }

  // --- Waveform ---
  function updateWaveform() {
    const { r, g, b } = state.color;
    const maxH = 160; // max bar height in px
    $('#wfR').style.height = (r / 255 * maxH) + 'px';
    $('#wfG').style.height = (g / 255 * maxH) + 'px';
    $('#wfB').style.height = (b / 255 * maxH) + 'px';
    $('#wfRVal').textContent = r;
    $('#wfGVal').textContent = g;
    $('#wfBVal').textContent = b;
    $('#wfHex').textContent = ColorMath.rgbToHex(r, g, b).toUpperCase();
    $('#wfPercent').textContent = `${Math.round(r/2.55)}% / ${Math.round(g/2.55)}% / ${Math.round(b/2.55)}%`;
  }

  // --- Mix playground ---
  function updateMixStrips() {
    const hexA = $('#mixColorA').value;
    const hexB = $('#mixColorB').value;
    const cA = ColorMath.hexToRgb(hexA.replace('#', ''));
    const cB = ColorMath.hexToRgb(hexB.replace('#', ''));
    if (!cA || !cB) return;

    $('#mixSwatchA').style.backgroundColor = hexA;
    $('#mixSwatchB').style.backgroundColor = hexB;

    const steps = 20;
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
    const { r, g, b } = state.color;
    const cube = $('#rgbCube');
    cube.style.transform = `rotateX(${cubeRotX}deg) rotateY(${cubeRotY}deg)`;

    const dot = $('#cubeDot');
    const x = (r / 255) * 160;
    const y = (1 - g / 255) * 160; // y inverted
    const z = (b / 255) * 160 - 80;
    const hex = ColorMath.rgbToHex(r, g, b);
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    dot.style.transform = `translate3d(-6px, -6px, ${z}px)`;
    dot.style.backgroundColor = hex;
    dot.style.color = hex;
  }

  function initCubeDrag() {
    const container = $('#cubeContainer');
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

  // --- Palette generation ---
  function renderPalettes() {
    const grid = $('#paletteGrid');
    grid.innerHTML = '';

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
          <button class="export-css" data-key="${key}">Copy CSS</button>
          <button class="export-tw" data-key="${key}">Copy Tailwind</button>
        </div>
      `;

      const swatchRow = card.querySelector('.palette-swatches');
      colors.forEach((c, i) => {
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
    });

    // Store the first palette for the contrast matrix
    state.currentPalette = Palette.generate('analogous', state.color);
  }

  // --- CVD simulator ---
  function renderCVD() {
    const grid = $('#cvdGrid');
    grid.innerHTML = '';

    // Use the current palette (analogous of active color by default)
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

    // Header row
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

    // Body
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
          td.textContent = '—';
        } else {
          const ratio = WCAG.contrastRatio(rowC, colC);
          td.textContent = ratio.toFixed(1);
          td.title = `${ratio.toFixed(2)}:1 — ${ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large' : 'Fail'}`;
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

  // --- Tab navigation ---
  function initTabs(tabSelector, panelPrefix) {
    const tabs = $$(tabSelector);
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const panelId = tab.getAttribute('aria-controls');
        // Deselect all
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
        if (panelId === 'panel-a11y' || panelId === 'sub-cvd') renderCVD();
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
    // Re-render palettes if visible
    if ($('#panel-palettes').classList.contains('active')) renderPalettes();
  }

  // --- Event listeners ---
  function init() {
    // Slider input
    [sliderR, sliderG, sliderB].forEach(slider => {
      slider.addEventListener('input', () => {
        setColor(+sliderR.value, +sliderG.value, +sliderB.value);
      });
      // Keyboard: shift+arrow for ±10
      slider.addEventListener('keydown', (e) => {
        if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowUp')) {
          e.preventDefault();
          slider.value = Math.min(255, +slider.value + 9); // browser already does +1
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
    $('#mixColorA').addEventListener('input', updateMixStrips);
    $('#mixColorB').addEventListener('input', updateMixStrips);
    $('#exportMixCSS').addEventListener('click', () => {
      const hexA = $('#mixColorA').value;
      const hexB = $('#mixColorB').value;
      const cA = ColorMath.hexToRgb(hexA.replace('#', ''));
      const cB = ColorMath.hexToRgb(hexB.replace('#', ''));
      if (!cA || !cB) return;
      const steps = 20;
      const colors = [];
      for (let i = 0; i <= steps; i++) {
        colors.push(ColorMath.lerpOklch(cA, cB, i / steps));
      }
      const css = Palette.exportCSS(colors, 'mix');
      navigator.clipboard.writeText(css).then(() => showToast('Mix CSS variables copied'));
    });

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
    initTabs('.nav-tab', 'panel');
    initTabs('#panel-explorer .sub-tab', 'sub');
    initTabs('#panel-a11y .sub-tab', 'sub');

    // Cube drag
    initCubeDrag();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === '?' || e.altKey) { /* allow shortcuts */ } else return;
      }

      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAccessibleMode(!state.accessibleMode);
      }
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        document.getElementById('tab-a11y').click();
        document.getElementById('subtab-contrast').click();
      }
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        sliderR.focus();
      }
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        document.getElementById('tab-palettes').click();
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

    // Render palettes on first visit
    renderPalettes();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
