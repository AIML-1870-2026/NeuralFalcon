// ===== Turing Pattern Lab - UI Controller =====

const UI = (() => {
  let brushRadius = 10;
  let brushErase = false;
  let brushActive = false;
  let brushPos = { x: 0, y: 0 };
  let mouseOnCanvas = false;
  let stepCount = 0;

  function init() {
    // Load URL params first
    Simulation.loadFromURL();

    const canvas = document.getElementById('sim-canvas');
    const ok = Simulation.init(canvas);
    if (!ok) return;

    setupModelSelect();
    setupPresetSelect();
    setupColorMapSelect();
    setupParamSliders();
    setupSimControls();
    setupBrushControls();
    setupExportControls();
    setupInfoModal();
    setupPanelToggle();
    setupKeyboard();
    setupCanvasInteraction();
    setupGridSizeSelect();

    // Sync UI with loaded state
    document.getElementById('model-select').value = Simulation.currentModel;
    document.getElementById('colormap-select').value = Simulation.currentColorMap;
    document.getElementById('speed-slider').value = Simulation.stepsPerFrame;
    document.getElementById('speed-val').textContent = Simulation.stepsPerFrame;
    document.getElementById('grid-size-select').value = Simulation.gridSize;
    updateStatusBar();

    // Start render loop
    window.addEventListener('resize', () => Simulation.resizeCanvas());
    Simulation.resizeCanvas();
    requestAnimationFrame(loop);
  }

  // ===== MAIN LOOP =====
  function loop() {
    if (Simulation.running) {
      const steps = Simulation.stepsPerFrame;
      for (let i = 0; i < steps; i++) {
        Simulation.step(brushActive, brushPos, brushRadius, brushErase);
        stepCount++;
      }

      // Compute metrics every ~8 sim steps
      if (stepCount % 8 === 0) {
        Simulation.computeMetrics();
        if (typeof MusicEngine !== 'undefined') {
          MusicEngine.update(Simulation.metrics);
        }
      }
    }

    Simulation.render();
    Simulation.updateFPS();
    updateStatusBar();

    requestAnimationFrame(loop);
  }

  function doStep() {
    Simulation.step(brushActive, brushPos, brushRadius, brushErase);
    stepCount++;
    if (stepCount % 8 === 0) {
      Simulation.computeMetrics();
      if (typeof MusicEngine !== 'undefined') {
        MusicEngine.update(Simulation.metrics);
      }
    }
    Simulation.render();
  }

  // ===== MODEL SELECT =====
  function setupModelSelect() {
    const sel = document.getElementById('model-select');
    sel.addEventListener('change', () => {
      Simulation.setModel(sel.value);
      setupPresetSelect();
      setupParamSliders();
      updateInfoContent();
      updateStatusBar();
    });
  }

  // ===== PRESET SELECT =====
  function setupPresetSelect() {
    const sel = document.getElementById('preset-select');
    const model = Simulation.MODELS[Simulation.currentModel];
    sel.innerHTML = '';
    model.presets.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${i + 1}. ${p.name}`;
      sel.appendChild(opt);
    });
    // Select current preset
    const idx = model.presets.findIndex(p => p.name === Simulation.currentPresetName);
    if (idx >= 0) sel.value = idx;

    sel.addEventListener('change', () => {
      Simulation.loadPreset(parseInt(sel.value));
      syncParamSliders();
      updateStatusBar();
    });
  }

  // ===== COLOR MAP =====
  function setupColorMapSelect() {
    const sel = document.getElementById('colormap-select');
    sel.value = Simulation.currentColorMap;
    sel.addEventListener('change', () => {
      Simulation.setColorMap(sel.value);
    });
  }

  // ===== PARAM SLIDERS =====
  function setupParamSliders() {
    const container = document.getElementById('param-sliders');
    container.innerHTML = '';
    const model = Simulation.MODELS[Simulation.currentModel];

    model.params.forEach(p => {
      const row = document.createElement('div');
      row.className = 'slider-row';

      const label = document.createElement('label');
      label.textContent = p.label;

      const input = document.createElement('input');
      input.type = 'range';
      input.min = p.min;
      input.max = p.max;
      input.step = p.step;
      input.value = Simulation.params[p.id];
      input.id = `param-${p.id}`;
      input.setAttribute('aria-label', p.label);

      const val = document.createElement('span');
      val.className = 'slider-val';
      val.id = `paramval-${p.id}`;
      val.textContent = formatParam(Simulation.params[p.id], p.step);

      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        Simulation.setParam(p.id, v);
        val.textContent = formatParam(v, p.step);
      });

      // Double-click to reset
      input.addEventListener('dblclick', () => {
        input.value = p.default;
        Simulation.setParam(p.id, p.default);
        val.textContent = formatParam(p.default, p.step);
      });

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(val);
      container.appendChild(row);
    });
  }

  function syncParamSliders() {
    const model = Simulation.MODELS[Simulation.currentModel];
    model.params.forEach(p => {
      const input = document.getElementById(`param-${p.id}`);
      const val = document.getElementById(`paramval-${p.id}`);
      if (input && val) {
        input.value = Simulation.params[p.id];
        val.textContent = formatParam(Simulation.params[p.id], p.step);
      }
    });
  }

  function formatParam(value, step) {
    if (step < 0.001) return value.toFixed(4);
    if (step < 0.01) return value.toFixed(3);
    if (step < 0.1) return value.toFixed(2);
    if (step < 1) return value.toFixed(1);
    return Math.round(value).toString();
  }

  // ===== SIM CONTROLS =====
  function setupSimControls() {
    const playBtn = document.getElementById('play-btn');
    const stepBtn = document.getElementById('step-btn');
    const clearBtn = document.getElementById('clear-btn');
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');

    playBtn.addEventListener('click', togglePlay);
    stepBtn.addEventListener('click', () => {
      Simulation.running = false;
      updatePlayButton();
      doStep();
    });
    clearBtn.addEventListener('click', () => {
      Simulation.initGrid();
      stepCount = 0;
    });

    speedSlider.addEventListener('input', () => {
      Simulation.stepsPerFrame = parseInt(speedSlider.value);
      speedVal.textContent = speedSlider.value;
    });
  }

  function togglePlay() {
    Simulation.running = !Simulation.running;
    updatePlayButton();
  }

  function updatePlayButton() {
    const btn = document.getElementById('play-btn');
    if (Simulation.running) {
      btn.textContent = '⏸ Pause';
      btn.classList.add('active');
    } else {
      btn.textContent = '▶ Play';
      btn.classList.remove('active');
    }
  }

  // ===== GRID SIZE =====
  function setupGridSizeSelect() {
    const sel = document.getElementById('grid-size-select');
    sel.addEventListener('change', () => {
      Simulation.setGridSize(parseInt(sel.value));
      updateStatusBar();
    });
  }

  // ===== BRUSH =====
  function setupBrushControls() {
    const slider = document.getElementById('brush-slider');
    const val = document.getElementById('brush-val');
    const seedBtn = document.getElementById('seed-mode-btn');
    const eraseBtn = document.getElementById('erase-mode-btn');

    slider.value = brushRadius;
    val.textContent = brushRadius;

    slider.addEventListener('input', () => {
      brushRadius = parseInt(slider.value);
      val.textContent = brushRadius;
    });

    seedBtn.addEventListener('click', () => {
      brushErase = false;
      seedBtn.classList.add('active');
      eraseBtn.classList.remove('active');
    });

    eraseBtn.addEventListener('click', () => {
      brushErase = true;
      eraseBtn.classList.add('active');
      seedBtn.classList.remove('active');
    });
  }

  // ===== CANVAS INTERACTION =====
  function setupCanvasInteraction() {
    const canvas = document.getElementById('sim-canvas');
    const indicator = document.getElementById('brush-indicator');
    const container = document.getElementById('canvas-container');

    function getCanvasUV(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: 1.0 - (e.clientY - rect.top) / rect.height // Flip Y
      };
    }

    function updateIndicator(e) {
      const rect = canvas.getBoundingClientRect();
      const pixelSize = rect.width / Simulation.gridSize;
      const size = brushRadius * 2 * pixelSize;
      indicator.style.width = size + 'px';
      indicator.style.height = size + 'px';
      indicator.style.left = (e.clientX - container.getBoundingClientRect().left - size / 2) + 'px';
      indicator.style.top = (e.clientY - container.getBoundingClientRect().top - size / 2) + 'px';

      if (brushErase || e.shiftKey) {
        indicator.classList.add('erase');
      } else {
        indicator.classList.remove('erase');
      }
    }

    canvas.addEventListener('mouseenter', (e) => {
      mouseOnCanvas = true;
      indicator.classList.add('visible');
      updateIndicator(e);
    });

    canvas.addEventListener('mouseleave', () => {
      mouseOnCanvas = false;
      indicator.classList.remove('visible');
      brushActive = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      updateIndicator(e);
      if (brushActive) {
        brushPos = getCanvasUV(e);
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        brushActive = true;
        brushPos = getCanvasUV(e);
        if (e.shiftKey) brushErase = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        brushActive = false;
        // Restore brush mode from buttons
        brushErase = document.getElementById('erase-mode-btn').classList.contains('active');
      }
    });

    // Scroll wheel for brush size
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      brushRadius = Math.max(1, Math.min(50, brushRadius + delta));
      document.getElementById('brush-slider').value = brushRadius;
      document.getElementById('brush-val').textContent = brushRadius;
      updateIndicator(e);
    }, { passive: false });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      brushActive = true;
      brushPos = getCanvasUV(touch);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      brushPos = getCanvasUV(touch);
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
      brushActive = false;
    });
  }

  // ===== EXPORT =====
  function setupExportControls() {
    document.getElementById('screenshot-btn').addEventListener('click', () => {
      const dataURL = Simulation.getScreenshot();
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = `turing-pattern-${Date.now()}.png`;
      a.click();
    });

    document.getElementById('permalink-btn').addEventListener('click', () => {
      const url = Simulation.getPermalink();
      navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('permalink-btn');
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = '🔗 Copy Link'; }, 2000);
      });
    });
  }

  // ===== INFO MODAL =====
  function setupInfoModal() {
    const modal = document.getElementById('info-modal');
    document.getElementById('info-btn').addEventListener('click', () => {
      updateInfoContent();
      modal.classList.remove('hidden');
    });
    document.getElementById('modal-close').addEventListener('click', () => {
      modal.classList.add('hidden');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  function updateInfoContent() {
    const model = Simulation.MODELS[Simulation.currentModel];
    document.getElementById('info-text').innerHTML = model.info;

    const guide = document.getElementById('pattern-guide');
    guide.innerHTML = '';
    model.presets.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'pattern-card';
      card.innerHTML = `<h4>${i + 1}. ${p.name}</h4><p>${p.desc}</p>`;
      card.addEventListener('click', () => {
        Simulation.loadPresetAndClear(i);
        syncParamSliders();
        document.getElementById('preset-select').value = i;
        updateStatusBar();
      });
      guide.appendChild(card);
    });
  }

  // ===== PANEL TOGGLE =====
  function setupPanelToggle() {
    const panel = document.getElementById('panel');
    const toggle = document.getElementById('panel-toggle');
    toggle.addEventListener('click', () => {
      panel.classList.toggle('panel-open');
      panel.classList.toggle('panel-closed');
      toggle.textContent = panel.classList.contains('panel-open') ? '◀' : '▶';
      setTimeout(() => Simulation.resizeCanvas(), 350);
    });
  }

  // ===== KEYBOARD =====
  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Don't capture if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 's':
        case 'S':
          Simulation.running = false;
          updatePlayButton();
          doStep();
          break;
        case 'c':
        case 'C':
          Simulation.initGrid();
          stepCount = 0;
          break;
        case 'm':
        case 'M':
          if (typeof MusicEngine !== 'undefined') {
            MusicEngine.toggle();
            updateMusicButton();
          }
          break;
        case '[':
          brushRadius = Math.max(1, brushRadius - 1);
          document.getElementById('brush-slider').value = brushRadius;
          document.getElementById('brush-val').textContent = brushRadius;
          break;
        case ']':
          brushRadius = Math.min(50, brushRadius + 1);
          document.getElementById('brush-slider').value = brushRadius;
          document.getElementById('brush-val').textContent = brushRadius;
          break;
        default:
          // Number keys 1-9 for presets
          const num = parseInt(e.key);
          if (num >= 1 && num <= 9) {
            const model = Simulation.MODELS[Simulation.currentModel];
            if (num <= model.presets.length) {
              Simulation.loadPreset(num - 1);
              syncParamSliders();
              document.getElementById('preset-select').value = num - 1;
              updateStatusBar();
            }
          }
      }
    });
  }

  // ===== STATUS BAR =====
  function updateStatusBar() {
    document.getElementById('fps-display').textContent = `FPS: ${Simulation.fps}`;
    document.getElementById('grid-display').textContent = `Grid: ${Simulation.gridSize}×${Simulation.gridSize}`;
    document.getElementById('preset-display').textContent = `Preset: ${Simulation.currentPresetName}`;
    document.getElementById('model-display').textContent = `Model: ${Simulation.MODELS[Simulation.currentModel].name}`;
  }

  function updateMusicButton() {
    const btn = document.getElementById('music-toggle');
    if (typeof MusicEngine !== 'undefined' && MusicEngine.enabled) {
      btn.textContent = 'ON';
      btn.classList.add('on');
    } else {
      btn.textContent = 'OFF';
      btn.classList.remove('on');
    }
  }

  // Expose for music engine
  window.updateMusicButton = updateMusicButton;

  // ===== INIT ON LOAD =====
  document.addEventListener('DOMContentLoaded', init);
})();
