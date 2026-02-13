// ── Neuron Configuration ──
const INPUTS = [
    { name: "Event Formality",        weight:  0.35, defaultVal: 5, max: 10 },
    { name: "Sock Visibility Risk",   weight:  0.25, defaultVal: 3, max: 10 },
    { name: "Laundry Desperation",    weight: -0.30, defaultVal: 7, max: 10 },
    { name: "Company You're Keeping", weight:  0.30, defaultVal: 2, max: 10 },
    { name: "Chaotic Energy Today",   weight: -0.20, defaultVal: 4, max: 10 },
    { name: "Matching Pairs Available",weight: 0.15, defaultVal: 6, max: 10 }
];

const DEFAULT_BIAS = -2.5;
const GRID_SIZE = 80;

// ── DOM References ──
const sliders = INPUTS.map((_, i) => document.getElementById(`slider-${i}`));
const sliderVals = INPUTS.map((_, i) => document.getElementById(`val-${i}`));
const biasSlider = document.getElementById("bias-slider");
const biasVal = document.getElementById("bias-val");
const outputSigma = document.getElementById("output-sigma");
const outputZ = document.getElementById("output-z");
const decisionEl = document.getElementById("decision");
const outputBox = document.getElementById("output-box");
const axisXSelect = document.getElementById("axis-x");
const axisYSelect = document.getElementById("axis-y");
const canvas = document.getElementById("heatmap");
const ctx = canvas.getContext("2d");
const xLabelEl = document.getElementById("x-label");
const yLabelEl = document.getElementById("y-label");
const tableBody = document.getElementById("weight-table-body");

// ── State ──
let axisX = 0;
let axisY = 3;
let isDragging = false;

// ── Math ──
function sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
}

function computeZ(values, bias) {
    let z = bias;
    for (let i = 0; i < INPUTS.length; i++) {
        z += (values[i] / INPUTS[i].max) * INPUTS[i].weight * 10;
    }
    return z;
}

function getInputValues() {
    return sliders.map(s => parseFloat(s.value));
}

function getBias() {
    return parseFloat(biasSlider.value);
}

// ── Color Interpolation ──
function sigmaToColor(sigma) {
    // blue (80,90,200) → white (255,255,255) → magenta (255,80,180)
    let r, g, b;
    if (sigma <= 0.5) {
        const t = sigma / 0.5;
        r = 80  + (255 - 80)  * t;
        g = 90  + (255 - 90)  * t;
        b = 200 + (255 - 200) * t;
    } else {
        const t = (sigma - 0.5) / 0.5;
        r = 255 + (255 - 255) * t;
        g = 255 + (80  - 255) * t;
        b = 255 + (180 - 255) * t;
    }
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// ── Heatmap Rendering ──
function renderHeatmap() {
    const values = getInputValues();
    const bias = getBias();
    const w = canvas.width;
    const h = canvas.height;
    const cellW = w / GRID_SIZE;
    const cellH = h / GRID_SIZE;

    // Precompute the fixed contribution (from non-axis inputs + bias)
    const contourPoints = [];

    for (let gy = 0; gy < GRID_SIZE; gy++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
            // Map grid cell to input values
            const xVal = (gx + 0.5) / GRID_SIZE * INPUTS[axisX].max;
            const yVal = INPUTS[axisY].max - (gy + 0.5) / GRID_SIZE * INPUTS[axisY].max;

            // Build values array with axis overrides
            const v = [...values];
            v[axisX] = xVal;
            v[axisY] = yVal;

            const z = computeZ(v, bias);
            const s = sigmoid(z);

            // Draw cell
            ctx.fillStyle = sigmaToColor(s);
            ctx.fillRect(gx * cellW, gy * cellH, cellW + 1, cellH + 1);

            // Track contour
            if (Math.abs(s - 0.5) < 0.018) {
                contourPoints.push({ x: gx * cellW + cellW / 2, y: gy * cellH + cellH / 2 });
            }
        }
    }

    // Draw contour line (gold dots for boundary)
    ctx.fillStyle = "#FFD700";
    for (const p of contourPoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw crosshair point
    const px = (values[axisX] / INPUTS[axisX].max) * w;
    const py = (1 - values[axisY] / INPUTS[axisY].max) * h;

    // Dashed guidelines
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
    ctx.stroke();
    ctx.setLineDash([]);

    // Gold dot
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#FFD700";
    ctx.fill();
    ctx.strokeStyle = "#0d1117";
    ctx.lineWidth = 2;
    ctx.stroke();
}

// ── Update Output Display ──
function updateOutput() {
    const values = getInputValues();
    const bias = getBias();
    const z = computeZ(values, bias);
    const s = sigmoid(z);

    outputSigma.textContent = s.toFixed(3);
    outputZ.textContent = z.toFixed(2);

    const isMatch = s >= 0.5;
    decisionEl.textContent = isMatch ? "✓ MATCH YOUR SOCKS" : "✗ MISMATCH IS FINE";
    decisionEl.className = "decision " + (isMatch ? "match" : "mismatch");
    outputBox.className = "output-box " + (isMatch ? "match" : "mismatch");

    // Update weight table
    updateWeightTable(values, bias, z);
}

function updateWeightTable(values, bias, z) {
    let html = "";
    for (let i = 0; i < INPUTS.length; i++) {
        const norm = values[i] / INPUTS[i].max;
        const contrib = norm * INPUTS[i].weight * 10;
        const sign = contrib >= 0 ? "+" : "";
        const cls = contrib >= 0 ? "contribution-positive" : "contribution-negative";
        html += `<tr>
            <td>${INPUTS[i].name}</td>
            <td>${values[i].toFixed(1)}</td>
            <td>${INPUTS[i].weight >= 0 ? "+" : ""}${INPUTS[i].weight.toFixed(2)}</td>
            <td class="${cls}">${sign}${contrib.toFixed(2)}</td>
        </tr>`;
    }
    html += `<tr>
        <td>Bias</td>
        <td></td>
        <td></td>
        <td class="${bias >= 0 ? "contribution-positive" : "contribution-negative"}">${bias >= 0 ? "+" : ""}${bias.toFixed(2)}</td>
    </tr>`;
    html += `<tr>
        <td><strong>Total z</strong></td>
        <td></td>
        <td></td>
        <td><strong>${z.toFixed(2)}</strong></td>
    </tr>`;
    tableBody.innerHTML = html;
}

// ── Sync All ──
function syncAll() {
    // Update slider value displays
    sliders.forEach((s, i) => {
        sliderVals[i].textContent = parseFloat(s.value).toFixed(1);
    });
    biasVal.textContent = (getBias() >= 0 ? "" : "−") + Math.abs(getBias()).toFixed(1);

    updateOutput();
    renderHeatmap();
}

// ── Axis Labels ──
function updateAxisLabels() {
    xLabelEl.textContent = INPUTS[axisX].name + " →";
    yLabelEl.textContent = "← " + INPUTS[axisY].name;
}

// ── Heatmap Pointer Interaction ──
function heatmapPointerToValues(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const xVal = Math.max(0, Math.min(INPUTS[axisX].max, (mx / canvas.width) * INPUTS[axisX].max));
    const yVal = Math.max(0, Math.min(INPUTS[axisY].max, (1 - my / canvas.height) * INPUTS[axisY].max));

    return { xVal, yVal };
}

function applyHeatmapDrag(e) {
    const { xVal, yVal } = heatmapPointerToValues(e);
    sliders[axisX].value = xVal;
    sliders[axisY].value = yVal;
    syncAll();
}

canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    canvas.setPointerCapture(e.pointerId);
    applyHeatmapDrag(e);
});

canvas.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    applyHeatmapDrag(e);
});

canvas.addEventListener("pointerup", (e) => {
    isDragging = false;
});

// ── Slider Events ──
sliders.forEach(s => s.addEventListener("input", syncAll));
biasSlider.addEventListener("input", syncAll);

// ── Axis Dropdown Events ──
axisXSelect.addEventListener("change", () => {
    const newX = parseInt(axisXSelect.value);
    if (newX === axisY) {
        // Auto-swap
        axisYSelect.value = axisX;
        axisY = axisX;
    }
    axisX = newX;
    updateAxisLabels();
    syncAll();
});

axisYSelect.addEventListener("change", () => {
    const newY = parseInt(axisYSelect.value);
    if (newY === axisX) {
        axisXSelect.value = axisY;
        axisX = axisY;
    }
    axisY = newY;
    updateAxisLabels();
    syncAll();
});

// ── Initialize ──
updateAxisLabels();
syncAll();
