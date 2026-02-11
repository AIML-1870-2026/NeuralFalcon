// Julia Set Explorer - Fractal Rendering Engine
(function () {
    // --- DOM refs ---
    const juliaCanvas = document.getElementById('julia-canvas');
    const mandelbrotCanvas = document.getElementById('mandelbrot-canvas');
    const jCtx = juliaCanvas.getContext('2d');
    const mCtx = mandelbrotCanvas.getContext('2d');

    const cRealSlider = document.getElementById('c-real');
    const cImagSlider = document.getElementById('c-imag');
    const iterSlider = document.getElementById('max-iter');
    const cRealVal = document.getElementById('c-real-val');
    const cImagVal = document.getElementById('c-imag-val');
    const iterVal = document.getElementById('iter-val');
    const zoomInfo = document.getElementById('zoom-info');
    const statusC = document.getElementById('status-c');
    const statusZoom = document.getElementById('status-zoom');
    const statusIter = document.getElementById('status-iter');
    const presetSelect = document.getElementById('preset-select');
    const colorSelect = document.getElementById('color-select');
    const splitBtn = document.getElementById('split-btn');
    const saveBtn = document.getElementById('save-btn');
    const resetBtn = document.getElementById('reset-btn');

    // --- State ---
    let cReal = -0.7269;
    let cImag = 0.1889;
    let maxIter = 200;
    let colorScheme = 'classic';
    let splitView = false;

    // Julia view
    let jView = { cx: 0, cy: 0, scale: 3 }; // scale = total width in fractal coords
    // Mandelbrot view
    let mView = { cx: -0.5, cy: 0, scale: 3.5 };

    // Interaction state
    let dragging = false;
    let dragCanvas = null;
    let dragStart = { x: 0, y: 0 };
    let dragViewStart = { cx: 0, cy: 0 };

    let needsRender = true;
    let needsMandelbrot = true;

    // --- Color palettes ---
    const palettes = {
        classic: (t) => {
            const r = Math.floor(9 * (1 - t) * t * t * t * 255);
            const g = Math.floor(15 * (1 - t) * (1 - t) * t * t * 255);
            const b = Math.floor(8.5 * (1 - t) * (1 - t) * (1 - t) * t * 255);
            return [r, g, b];
        },
        fire: (t) => {
            const r = Math.min(255, Math.floor(t * 3 * 255));
            const g = Math.min(255, Math.floor(Math.max(0, t * 3 - 1) * 255));
            const b = Math.min(255, Math.floor(Math.max(0, t * 3 - 2) * 255));
            return [r, g, b];
        },
        ocean: (t) => {
            const r = Math.floor(t * t * 100);
            const g = Math.floor(t * 180);
            const b = Math.floor(150 + t * 105);
            return [r, g, b];
        },
        neon: (t) => {
            const angle = t * Math.PI * 2;
            const r = Math.floor(128 + 127 * Math.sin(angle));
            const g = Math.floor(128 + 127 * Math.sin(angle + 2.094));
            const b = Math.floor(128 + 127 * Math.sin(angle + 4.189));
            return [r, g, b];
        },
        grayscale: (t) => {
            const v = Math.floor(t * 255);
            return [v, v, v];
        },
        rainbow: (t) => {
            const h = t * 360;
            const s = 1, l = 0.5;
            const c = (1 - Math.abs(2 * l - 1)) * s;
            const x = c * (1 - Math.abs((h / 60) % 2 - 1));
            const m = l - c / 2;
            let r, g, b;
            if (h < 60) { r = c; g = x; b = 0; }
            else if (h < 120) { r = x; g = c; b = 0; }
            else if (h < 180) { r = 0; g = c; b = x; }
            else if (h < 240) { r = 0; g = x; b = c; }
            else if (h < 300) { r = x; g = 0; b = c; }
            else { r = c; g = 0; b = x; }
            return [Math.floor((r + m) * 255), Math.floor((g + m) * 255), Math.floor((b + m) * 255)];
        }
    };

    // --- Presets ---
    const presets = {
        dendrite: { re: 0, im: 1 },
        rabbit: { re: -0.123, im: 0.745 },
        sanmarco: { re: -0.75, im: 0 },
        spiral: { re: 0.285, im: 0.01 },
        lightning: { re: -0.4, im: 0.6 }
    };

    // --- Resize ---
    function resize() {
        const wrap = document.getElementById('canvas-wrap');
        const rect = wrap.getBoundingClientRect();
        if (splitView) {
            const hw = Math.floor(rect.width / 2);
            mandelbrotCanvas.width = hw;
            mandelbrotCanvas.height = rect.height;
            juliaCanvas.width = rect.width - hw;
            juliaCanvas.height = rect.height;
        } else {
            juliaCanvas.width = rect.width;
            juliaCanvas.height = rect.height;
        }
        needsRender = true;
        needsMandelbrot = true;
    }

    // --- Fractal computation ---
    function computeJulia(canvas, ctx, view, cr, ci, maxIt, palette) {
        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return;
        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;
        const aspect = w / h;
        const xMin = view.cx - view.scale / 2 * aspect;
        const yMin = view.cy - view.scale / 2;
        const dx = view.scale * aspect / w;
        const dy = view.scale / h;
        const pal = palettes[palette];
        const logBase = 1 / Math.log(2);
        const log2 = Math.log(2);

        for (let py = 0; py < h; py++) {
            const y0 = yMin + py * dy;
            for (let px = 0; px < w; px++) {
                const x0 = xMin + px * dx;
                let x = x0, y = y0;
                let i = 0;
                for (; i < maxIt; i++) {
                    const x2 = x * x, y2 = y * y;
                    if (x2 + y2 > 4) break;
                    y = 2 * x * y + ci;
                    x = x2 - y2 + cr;
                }
                const idx = (py * w + px) * 4;
                if (i === maxIt) {
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                } else {
                    // Smooth coloring
                    const zn = Math.sqrt(x * x + y * y);
                    const smooth = i + 1 - Math.log(Math.log(zn)) * logBase;
                    const t = (smooth % 50) / 50;
                    const [r, g, b] = pal(t);
                    data[idx] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                }
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }

    function computeMandelbrot(canvas, ctx, view, maxIt, palette) {
        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return;
        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;
        const aspect = w / h;
        const xMin = view.cx - view.scale / 2 * aspect;
        const yMin = view.cy - view.scale / 2;
        const dx = view.scale * aspect / w;
        const dy = view.scale / h;
        const pal = palettes[palette];
        const logBase = 1 / Math.log(2);

        for (let py = 0; py < h; py++) {
            const ci = yMin + py * dy;
            for (let px = 0; px < w; px++) {
                const cr = xMin + px * dx;
                let x = 0, y = 0;
                let i = 0;
                for (; i < maxIt; i++) {
                    const x2 = x * x, y2 = y * y;
                    if (x2 + y2 > 4) break;
                    y = 2 * x * y + ci;
                    x = x2 - y2 + cr;
                }
                const idx = (py * w + px) * 4;
                if (i === maxIt) {
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                } else {
                    const zn = Math.sqrt(x * x + y * y);
                    const smooth = i + 1 - Math.log(Math.log(zn)) * logBase;
                    const t = (smooth % 50) / 50;
                    const [r, g, b] = pal(t);
                    data[idx] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                }
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        // Draw crosshair at current c
        const cpx = (cReal - xMin) / dx;
        const cpy = (cImag - yMin) / dy;
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cpx - 10, cpy); ctx.lineTo(cpx + 10, cpy);
        ctx.moveTo(cpx, cpy - 10); ctx.lineTo(cpx, cpy + 10);
        ctx.stroke();
    }

    // --- Rendering with chunking for responsiveness ---
    let renderQueued = false;

    function scheduleRender() {
        needsRender = true;
        if (!renderQueued) {
            renderQueued = true;
            requestAnimationFrame(doRender);
        }
    }

    function doRender() {
        renderQueued = false;
        if (needsRender) {
            needsRender = false;
            computeJulia(juliaCanvas, jCtx, jView, cReal, cImag, maxIter, colorScheme);
        }
        if (splitView && needsMandelbrot) {
            needsMandelbrot = false;
            computeMandelbrot(mandelbrotCanvas, mCtx, mView, maxIter, colorScheme);
        }
    }

    // --- UI Updates ---
    function updateStatus() {
        const sign = cImag >= 0 ? '+' : '-';
        const absImag = Math.abs(cImag);
        statusC.textContent = `c = ${cReal.toFixed(4)} ${sign} ${absImag.toFixed(4)}i`;
        const zoom = (3 / jView.scale).toFixed(2);
        statusZoom.textContent = `Zoom ${zoom}x`;
        zoomInfo.textContent = `Zoom: ${zoom}x`;
        statusIter.textContent = `${maxIter} iter`;
    }

    function setC(re, im) {
        cReal = re;
        cImag = im;
        cRealSlider.value = re;
        cImagSlider.value = im;
        cRealVal.textContent = re.toFixed(4);
        cImagVal.textContent = im.toFixed(4);
        updateStatus();
        needsMandelbrot = true;
        scheduleRender();
    }

    // --- Event handlers ---
    cRealSlider.addEventListener('input', () => {
        cReal = parseFloat(cRealSlider.value);
        cRealVal.textContent = cReal.toFixed(4);
        updateStatus();
        needsMandelbrot = true;
        scheduleRender();
    });
    cImagSlider.addEventListener('input', () => {
        cImag = parseFloat(cImagSlider.value);
        cImagVal.textContent = cImag.toFixed(4);
        updateStatus();
        needsMandelbrot = true;
        scheduleRender();
    });
    iterSlider.addEventListener('input', () => {
        maxIter = parseInt(iterSlider.value);
        iterVal.textContent = maxIter;
        updateStatus();
        needsMandelbrot = true;
        scheduleRender();
    });

    presetSelect.addEventListener('change', () => {
        const p = presets[presetSelect.value];
        if (p) {
            jView = { cx: 0, cy: 0, scale: 3 };
            setC(p.re, p.im);
        }
    });

    colorSelect.addEventListener('change', () => {
        colorScheme = colorSelect.value;
        needsMandelbrot = true;
        scheduleRender();
    });

    resetBtn.addEventListener('click', () => {
        jView = { cx: 0, cy: 0, scale: 3 };
        mView = { cx: -0.5, cy: 0, scale: 3.5 };
        updateStatus();
        needsMandelbrot = true;
        scheduleRender();
    });

    saveBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'julia-set.png';
        link.href = juliaCanvas.toDataURL('image/png');
        link.click();
    });

    splitBtn.addEventListener('click', () => {
        splitView = !splitView;
        splitBtn.classList.toggle('active', splitView);
        mandelbrotCanvas.classList.toggle('hidden', !splitView);
        resize();
    });

    // --- Zoom (mouse wheel) ---
    function handleWheel(e, canvas, view) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const aspect = canvas.width / canvas.height;

        // Mouse position in fractal coords
        const fx = view.cx + (mx / canvas.width - 0.5) * view.scale * aspect;
        const fy = view.cy + (my / canvas.height - 0.5) * view.scale;

        const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        view.scale *= factor;

        // Adjust center so cursor stays on same fractal point
        view.cx = fx - (mx / canvas.width - 0.5) * view.scale * aspect;
        view.cy = fy - (my / canvas.height - 0.5) * view.scale;

        updateStatus();
    }

    juliaCanvas.addEventListener('wheel', (e) => {
        handleWheel(e, juliaCanvas, jView);
        scheduleRender();
    }, { passive: false });

    mandelbrotCanvas.addEventListener('wheel', (e) => {
        handleWheel(e, mandelbrotCanvas, mView);
        needsMandelbrot = true;
        scheduleRender();
    }, { passive: false });

    // --- Pan (click-drag) ---
    function startDrag(e, canvas, view) {
        dragging = true;
        dragCanvas = canvas;
        dragStart = { x: e.clientX, y: e.clientY };
        dragViewStart = { cx: view.cx, cy: view.cy };
    }

    juliaCanvas.addEventListener('mousedown', (e) => {
        startDrag(e, juliaCanvas, jView);
    });
    mandelbrotCanvas.addEventListener('mousedown', (e) => {
        startDrag(e, mandelbrotCanvas, mView);
    });

    window.addEventListener('mousemove', (e) => {
        if (!dragging) {
            // Hover on Mandelbrot in split view
            if (splitView) {
                const rect = mandelbrotCanvas.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    const mx = e.clientX - rect.left;
                    const my = e.clientY - rect.top;
                    const aspect = mandelbrotCanvas.width / mandelbrotCanvas.height;
                    const fx = mView.cx + (mx / mandelbrotCanvas.width - 0.5) * mView.scale * aspect;
                    const fy = mView.cy + (my / mandelbrotCanvas.height - 0.5) * mView.scale;
                    setC(fx, fy);
                }
            }
            return;
        }
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const view = dragCanvas === juliaCanvas ? jView : mView;
        const aspect = dragCanvas.width / dragCanvas.height;
        view.cx = dragViewStart.cx - dx / dragCanvas.width * view.scale * aspect;
        view.cy = dragViewStart.cy - dy / dragCanvas.height * view.scale;
        updateStatus();
        if (dragCanvas === mandelbrotCanvas) needsMandelbrot = true;
        scheduleRender();
    });

    window.addEventListener('mouseup', () => {
        dragging = false;
        dragCanvas = null;
    });

    // Click on Mandelbrot to lock c
    mandelbrotCanvas.addEventListener('click', (e) => {
        if (splitView) {
            const rect = mandelbrotCanvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const aspect = mandelbrotCanvas.width / mandelbrotCanvas.height;
            const fx = mView.cx + (mx / mandelbrotCanvas.width - 0.5) * mView.scale * aspect;
            const fy = mView.cy + (my / mandelbrotCanvas.height - 0.5) * mView.scale;
            setC(fx, fy);
        }
    });

    // --- Touch support ---
    juliaCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            const t = e.touches[0];
            startDrag({ clientX: t.clientX, clientY: t.clientY }, juliaCanvas, jView);
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (dragging && e.touches.length === 1) {
            const t = e.touches[0];
            const dx = t.clientX - dragStart.x;
            const dy = t.clientY - dragStart.y;
            const view = dragCanvas === juliaCanvas ? jView : mView;
            const aspect = dragCanvas.width / dragCanvas.height;
            view.cx = dragViewStart.cx - dx / dragCanvas.width * view.scale * aspect;
            view.cy = dragViewStart.cy - dy / dragCanvas.height * view.scale;
            updateStatus();
            scheduleRender();
        }
    }, { passive: true });

    window.addEventListener('touchend', () => { dragging = false; });

    // --- Init ---
    window.addEventListener('resize', resize);
    resize();
    updateStatus();
    scheduleRender();
})();
