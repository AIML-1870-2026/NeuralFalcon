// ── State ──────────────────────────────────────────────────────
const state = {
    boids: [],
    predators: [],
    params: {
        separation: 1.5,
        alignment: 1.0,
        cohesion: 1.0,
        neighborRadius: 50,
        maxSpeed: 4,
        fearRadius: 150,
        predatorSpeed: 1.0,
        fov: 270,
        useFov: false,
        boundaryMode: 'wrap',
    },
    ui: {
        paused: true,
        showTrails: false,
        trailLength: 20,
        trailOpacity: 0.4,
        theme: 'minimal',
        showVisionCone: false,
        selectedBoid: null,
    },
    metrics: {
        fps: 0,
        avgSpeed: 0,
        avgNeighbors: 0,
        fovPercent: 100,
    },
    activePreset: null,
};

const BOID_COUNT = 150;
const THEMES = {
    minimal: {
        bg: '#ffffff',
        boidColor: '#333333',
        trail: '#999999',
        predator: { hawk: '#c0392b', snake: '#27ae60', shark: '#2c3e50' },
    },
    neon: {
        bg: '#0a0a0a',
        boidColor: '#00ffff',
        trail: '#ff00ff',
        predator: { hawk: '#ff6600', snake: '#00ff00', shark: '#ffff00' },
        glow: true,
    },
    nature: {
        bg: null, // gradient handled in CSS
        boidColor: '#5d4037',
        trail: '#d7ccc8',
        predator: { hawk: '#8b4513', snake: '#2e7d32', shark: '#607d8b' },
    },
};

const PRESETS = {
    schooling: { separation: 1.0, alignment: 2.5, cohesion: 1.5, neighborRadius: 75, maxSpeed: 3.5 },
    chaotic:   { separation: 0.5, alignment: 0.3, cohesion: 0.3, neighborRadius: 30, maxSpeed: 6 },
    tight:     { separation: 1.2, alignment: 1.0, cohesion: 3.0, neighborRadius: 100, maxSpeed: 2.5 },
};

const DEFAULTS = { separation: 1.5, alignment: 1.0, cohesion: 1.0, neighborRadius: 50, maxSpeed: 4 };

// ── Canvas Setup ──────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W, H;

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    W = rect.width;
    H = rect.height;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Boid & Predator Classes ──────────────────────────────────
function createBoid() {
    return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        trail: [],
        neighborCount: 0,
        visibleNeighborCount: 0,
    };
}

function createPredator(type, x, y) {
    const p = {
        type,
        x: x || Math.random() * W,
        y: y || Math.random() * H,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        // Hawk state
        attackTimer: 0,
        cooldownTimer: 0,
        // Snake state
        targetIndex: -1,
        // Shark state
        patrolCenterX: 0,
        patrolCenterY: 0,
        patrolAngle: Math.random() * Math.PI * 2,
    };
    p.patrolCenterX = p.x;
    p.patrolCenterY = p.y;
    return p;
}

// ── Initialization ────────────────────────────────────────────
function spawnBoids() {
    state.boids = [];
    for (let i = 0; i < BOID_COUNT; i++) {
        state.boids.push(createBoid());
    }
}

spawnBoids();

// ── Vector Helpers ────────────────────────────────────────────
function mag(x, y) { return Math.sqrt(x * x + y * y); }
function clamp(vx, vy, max) {
    const m = mag(vx, vy);
    if (m > max && m > 0) {
        return [vx / m * max, vy / m * max];
    }
    return [vx, vy];
}
function angleBetween(ax, ay, bx, by) {
    const dot = ax * bx + ay * by;
    const ma = mag(ax, ay);
    const mb = mag(bx, by);
    if (ma === 0 || mb === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / (ma * mb))));
}

// ── Boid Update ───────────────────────────────────────────────
function updateBoids() {
    const { separation, alignment, cohesion, neighborRadius, maxSpeed, fearRadius, useFov, fov } = state.params;
    const fovRad = (fov / 180) * Math.PI;
    let totalNeighbors = 0;
    let totalVisible = 0;

    for (let i = 0; i < state.boids.length; i++) {
        const b = state.boids[i];
        let sepX = 0, sepY = 0;
        let aliX = 0, aliY = 0;
        let cohX = 0, cohY = 0;
        let count = 0;
        let visCount = 0;

        for (let j = 0; j < state.boids.length; j++) {
            if (i === j) continue;
            const o = state.boids[j];
            let dx = o.x - b.x;
            let dy = o.y - b.y;

            // Handle wrapping distance
            if (state.params.boundaryMode === 'wrap') {
                if (dx > W / 2) dx -= W;
                if (dx < -W / 2) dx += W;
                if (dy > H / 2) dy -= H;
                if (dy < -H / 2) dy += H;
            }

            const dist = mag(dx, dy);
            if (dist > neighborRadius || dist === 0) continue;

            count++;

            // FOV check
            if (useFov) {
                const angle = angleBetween(b.vx, b.vy, dx, dy);
                if (angle > fovRad / 2) continue;
            }

            visCount++;

            // Separation
            sepX -= dx / (dist * dist);
            sepY -= dy / (dist * dist);

            // Alignment
            aliX += o.vx;
            aliY += o.vy;

            // Cohesion
            cohX += dx;
            cohY += dy;
        }

        b.neighborCount = count;
        b.visibleNeighborCount = visCount;
        totalNeighbors += count;
        totalVisible += visCount;

        if (visCount > 0) {
            aliX /= visCount;
            aliY /= visCount;
            cohX /= visCount;
            cohY /= visCount;
        }

        let ax = sepX * separation * 40 + aliX * alignment * 0.1 + cohX * cohesion * 0.01;
        let ay = sepY * separation * 40 + aliY * alignment * 0.1 + cohY * cohesion * 0.01;

        // Predator flee
        for (const p of state.predators) {
            let dx = b.x - p.x;
            let dy = b.y - p.y;
            if (state.params.boundaryMode === 'wrap') {
                if (dx > W / 2) dx -= W;
                if (dx < -W / 2) dx += W;
                if (dy > H / 2) dy -= H;
                if (dy < -H / 2) dy += H;
            }
            const dist = mag(dx, dy);
            if (dist < fearRadius && dist > 0) {
                const force = 3.0 / (dist * dist) * 1000;
                ax += (dx / dist) * force;
                ay += (dy / dist) * force;
            }
        }

        b.vx += ax;
        b.vy += ay;
        [b.vx, b.vy] = clamp(b.vx, b.vy, maxSpeed);

        b.x += b.vx;
        b.y += b.vy;

        // Boundary
        if (state.params.boundaryMode === 'wrap') {
            if (b.x < 0) b.x += W;
            if (b.x > W) b.x -= W;
            if (b.y < 0) b.y += H;
            if (b.y > H) b.y -= H;
        } else {
            if (b.x < 0) { b.x = 0; b.vx *= -1; }
            if (b.x > W) { b.x = W; b.vx *= -1; }
            if (b.y < 0) { b.y = 0; b.vy *= -1; }
            if (b.y > H) { b.y = H; b.vy *= -1; }
        }

        // Trail
        if (state.ui.showTrails) {
            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > state.ui.trailLength) {
                b.trail.shift();
            }
        }
    }

    // Metrics
    let totalSpeed = 0;
    for (const b of state.boids) {
        totalSpeed += mag(b.vx, b.vy);
    }
    state.metrics.avgSpeed = (totalSpeed / state.boids.length).toFixed(1);
    state.metrics.avgNeighbors = (totalNeighbors / state.boids.length).toFixed(1);
    if (useFov && totalNeighbors > 0) {
        state.metrics.fovPercent = Math.round((totalVisible / totalNeighbors) * 100);
    } else {
        state.metrics.fovPercent = 100;
    }
}

// ── Predator Update ───────────────────────────────────────────
function updatePredators() {
    const baseSpeed = state.params.maxSpeed * state.params.predatorSpeed;

    for (const p of state.predators) {
        switch (p.type) {
            case 'hawk':
                updateHawk(p, baseSpeed);
                break;
            case 'snake':
                updateSnake(p, baseSpeed);
                break;
            case 'shark':
                updateShark(p, baseSpeed);
                break;
        }

        // Boundary
        if (state.params.boundaryMode === 'wrap') {
            if (p.x < 0) p.x += W;
            if (p.x > W) p.x -= W;
            if (p.y < 0) p.y += H;
            if (p.y > H) p.y -= H;
        } else {
            if (p.x < 0) { p.x = 0; p.vx *= -1; }
            if (p.x > W) { p.x = W; p.vx *= -1; }
            if (p.y < 0) { p.y = 0; p.vy *= -1; }
            if (p.y > H) { p.y = H; p.vy *= -1; }
        }
    }
}

function updateHawk(p, baseSpeed) {
    if (p.cooldownTimer > 0) {
        p.cooldownTimer--;
        // Slow patrol
        const speed = baseSpeed * 0.5;
        p.x += p.vx;
        p.y += p.vy;
        [p.vx, p.vy] = clamp(p.vx, p.vy, speed);
        // Gentle wander
        p.vx += (Math.random() - 0.5) * 0.3;
        p.vy += (Math.random() - 0.5) * 0.3;
        return;
    }

    if (p.attackTimer > 0) {
        p.attackTimer--;
        p.x += p.vx;
        p.y += p.vy;
        if (p.attackTimer === 0) p.cooldownTimer = 120;
        return;
    }

    // Look for target
    let nearest = null, minDist = 150;
    for (const b of state.boids) {
        const dist = mag(b.x - p.x, b.y - p.y);
        if (dist < minDist) {
            minDist = dist;
            nearest = b;
        }
    }

    if (nearest) {
        const dx = nearest.x - p.x;
        const dy = nearest.y - p.y;
        const d = mag(dx, dy);
        const speed = baseSpeed * 2.5;
        p.vx = (dx / d) * speed;
        p.vy = (dy / d) * speed;
        p.attackTimer = 60;
    } else {
        p.vx += (Math.random() - 0.5) * 0.3;
        p.vy += (Math.random() - 0.5) * 0.3;
        [p.vx, p.vy] = clamp(p.vx, p.vy, baseSpeed * 0.5);
        p.x += p.vx;
        p.y += p.vy;
    }
}

function updateSnake(p, baseSpeed) {
    const speed = baseSpeed * 0.9;

    // Find or re-find target
    if (p.targetIndex < 0 || p.targetIndex >= state.boids.length) {
        p.targetIndex = 0;
    }

    const target = state.boids[p.targetIndex];
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = mag(dx, dy);

    if (dist > 300) {
        // Re-target nearest
        let minD = Infinity;
        for (let i = 0; i < state.boids.length; i++) {
            const d = mag(state.boids[i].x - p.x, state.boids[i].y - p.y);
            if (d < minD) { minD = d; p.targetIndex = i; }
        }
    }

    if (dist > 0) {
        p.vx += (dx / dist) * 0.5;
        p.vy += (dy / dist) * 0.5;
    }
    [p.vx, p.vy] = clamp(p.vx, p.vy, speed);
    p.x += p.vx;
    p.y += p.vy;
}

function updateShark(p, baseSpeed) {
    const patrolRadius = 80;
    const dx = p.x - p.patrolCenterX;
    const dy = p.y - p.patrolCenterY;
    const distFromCenter = mag(dx, dy);

    // Check for boids in patrol radius
    let target = null;
    let minDist = patrolRadius * 1.5;
    for (const b of state.boids) {
        const d = mag(b.x - p.patrolCenterX, b.y - p.patrolCenterY);
        if (d < patrolRadius && d < minDist) {
            minDist = d;
            target = b;
        }
    }

    if (target) {
        const tdx = target.x - p.x;
        const tdy = target.y - p.y;
        const td = mag(tdx, tdy);
        if (td > 0) {
            p.vx += (tdx / td) * 0.8;
            p.vy += (tdy / td) * 0.8;
        }
        [p.vx, p.vy] = clamp(p.vx, p.vy, baseSpeed * 1.2);
    } else {
        // Patrol circle
        p.patrolAngle += 0.03;
        const tx = p.patrolCenterX + Math.cos(p.patrolAngle) * patrolRadius;
        const ty = p.patrolCenterY + Math.sin(p.patrolAngle) * patrolRadius;
        const tdx = tx - p.x;
        const tdy = ty - p.y;
        const td = mag(tdx, tdy);
        if (td > 0) {
            p.vx += (tdx / td) * 0.3;
            p.vy += (tdy / td) * 0.3;
        }
        [p.vx, p.vy] = clamp(p.vx, p.vy, baseSpeed * 0.6);
    }

    p.x += p.vx;
    p.y += p.vy;
}

// ── Rendering ─────────────────────────────────────────────────
function render() {
    const theme = THEMES[state.ui.theme];

    // Clear
    ctx.clearRect(0, 0, W, H);
    if (theme.bg) {
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, W, H);
    }

    // Save default
    ctx.save();

    // Trails
    if (state.ui.showTrails) {
        for (const b of state.boids) {
            if (b.trail.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(b.trail[0].x, b.trail[0].y);
            for (let i = 1; i < b.trail.length; i++) {
                // Skip if big jump (wrap)
                const dx = Math.abs(b.trail[i].x - b.trail[i - 1].x);
                const dy = Math.abs(b.trail[i].y - b.trail[i - 1].y);
                if (dx > W / 2 || dy > H / 2) {
                    ctx.moveTo(b.trail[i].x, b.trail[i].y);
                } else {
                    ctx.lineTo(b.trail[i].x, b.trail[i].y);
                }
            }
            ctx.strokeStyle = theme.trail;
            ctx.globalAlpha = state.ui.trailOpacity;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // Vision cone for selected boid
    if (state.ui.showVisionCone && state.params.useFov && state.ui.selectedBoid !== null) {
        const b = state.boids[state.ui.selectedBoid];
        if (b) {
            const heading = Math.atan2(b.vy, b.vx);
            const halfFov = (state.params.fov / 360) * Math.PI;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.arc(b.x, b.y, state.params.neighborRadius, heading - halfFov, heading + halfFov);
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 150, 255, 0.08)';
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.3)';
            ctx.fill();
            ctx.stroke();
        }
    }

    // Shark patrol zones
    for (const p of state.predators) {
        if (p.type === 'shark') {
            ctx.beginPath();
            ctx.arc(p.patrolCenterX, p.patrolCenterY, 80, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // Boids
    const useGlow = theme.glow;
    if (useGlow) {
        ctx.shadowColor = theme.boidColor;
        ctx.shadowBlur = 8;
    }

    for (let i = 0; i < state.boids.length; i++) {
        const b = state.boids[i];
        const heading = Math.atan2(b.vy, b.vx);
        const size = 6;

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(heading);

        if (state.ui.theme === 'nature') {
            // Bird silhouette
            ctx.fillStyle = theme.boidColor;
            ctx.beginPath();
            ctx.moveTo(size, 0);
            ctx.lineTo(-size * 0.6, -size * 0.7);
            ctx.quadraticCurveTo(-size * 0.2, 0, -size * 0.6, size * 0.7);
            ctx.closePath();
            ctx.fill();
        } else {
            // Triangle
            ctx.fillStyle = theme.boidColor;
            ctx.beginPath();
            ctx.moveTo(size, 0);
            ctx.lineTo(-size * 0.5, -size * 0.5);
            ctx.lineTo(-size * 0.5, size * 0.5);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();

        // Highlight selected boid
        if (i === state.ui.selectedBoid) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff0';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    ctx.shadowBlur = 0;

    // Predators
    for (const p of state.predators) {
        const color = theme.predator[p.type];
        const heading = Math.atan2(p.vy, p.vx);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(heading);

        if (useGlow) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
        }

        ctx.fillStyle = color;

        switch (p.type) {
            case 'hawk': {
                // Larger triangle
                const s = 12;
                ctx.beginPath();
                ctx.moveTo(s, 0);
                ctx.lineTo(-s * 0.6, -s * 0.7);
                ctx.lineTo(-s * 0.3, 0);
                ctx.lineTo(-s * 0.6, s * 0.7);
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'snake': {
                // Elongated shape
                ctx.beginPath();
                ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI * 2);
                ctx.fill();
                // Head
                ctx.beginPath();
                ctx.arc(10, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'shark': {
                // Fin shape
                const s = 10;
                ctx.beginPath();
                ctx.moveTo(s, 0);
                ctx.lineTo(-s, -s * 0.5);
                ctx.lineTo(-s * 0.5, 0);
                ctx.lineTo(-s, s * 0.5);
                ctx.closePath();
                ctx.fill();
                // Dorsal fin
                ctx.beginPath();
                ctx.moveTo(0, -s * 0.5);
                ctx.lineTo(-s * 0.3, -s * 1.2);
                ctx.lineTo(-s * 0.6, -s * 0.3);
                ctx.closePath();
                ctx.fill();
                break;
            }
        }

        ctx.restore();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
}

// ── FPS Tracking ──────────────────────────────────────────────
let frameCount = 0;
let fpsTime = performance.now();

function trackFPS(now) {
    frameCount++;
    if (now - fpsTime >= 500) {
        state.metrics.fps = Math.round(frameCount / ((now - fpsTime) / 1000));
        frameCount = 0;
        fpsTime = now;
    }
}

// ── Main Loop ─────────────────────────────────────────────────
function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);
    trackFPS(timestamp);

    if (!state.ui.paused) {
        updatePredators();
        updateBoids();
    }

    render();
    updateMetricsDisplay();
}

function updateMetricsDisplay() {
    document.getElementById('fps-display').textContent = state.metrics.fps + ' fps';
    document.getElementById('boid-count-display').textContent = state.boids.length + ' boids';
    document.getElementById('avg-speed-display').textContent = 'Avg Speed: ' + state.metrics.avgSpeed;
    document.getElementById('avg-neighbors-display').textContent = 'Avg Neighbors: ' + state.metrics.avgNeighbors;

    // FOV info
    const fovInfo = document.getElementById('fov-info');
    if (state.params.useFov) {
        fovInfo.classList.remove('hidden');
        fovInfo.textContent = `Boids see ${state.metrics.fovPercent}% of neighbors`;
    } else {
        fovInfo.classList.add('hidden');
    }
}

// ── UI Wiring ─────────────────────────────────────────────────
function wireSlider(id, param, displayId, transform) {
    const slider = document.getElementById(id);
    const display = document.getElementById(displayId);
    slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        if (transform) {
            transform(val);
        } else {
            state.params[param] = val;
        }
        display.textContent = slider.value;
        state.activePreset = null;
        updatePresetLabel();
    });
}

wireSlider('separation', 'separation', 'sep-val');
wireSlider('alignment', 'alignment', 'ali-val');
wireSlider('cohesion', 'cohesion', 'coh-val');
wireSlider('neighborRadius', 'neighborRadius', 'rad-val');
wireSlider('maxSpeed', 'maxSpeed', 'spd-val');
wireSlider('fearRadius', 'fearRadius', 'fear-val');
wireSlider('predatorSpeed', 'predatorSpeed', 'pred-spd-val');
wireSlider('fov', 'fov', 'fov-val');

// Trail sliders
document.getElementById('trailLength').addEventListener('input', (e) => {
    state.ui.trailLength = parseInt(e.target.value);
    document.getElementById('trail-len-val').textContent = e.target.value;
});
document.getElementById('trailOpacity').addEventListener('input', (e) => {
    state.ui.trailOpacity = parseInt(e.target.value) / 100;
    document.getElementById('trail-opa-val').textContent = e.target.value;
});

// Checkboxes
document.getElementById('use-fov').addEventListener('change', (e) => {
    state.params.useFov = e.target.checked;
});
document.getElementById('show-vision').addEventListener('change', (e) => {
    state.ui.showVisionCone = e.target.checked;
    if (e.target.checked && state.ui.selectedBoid === null) {
        state.ui.selectedBoid = 0;
    }
});
document.getElementById('show-trails').addEventListener('change', (e) => {
    state.ui.showTrails = e.target.checked;
    if (!e.target.checked) {
        for (const b of state.boids) b.trail = [];
    }
});

// Presets
function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;

    state.params.separation = preset.separation;
    state.params.alignment = preset.alignment;
    state.params.cohesion = preset.cohesion;
    state.params.neighborRadius = preset.neighborRadius;
    state.params.maxSpeed = preset.maxSpeed;

    document.getElementById('separation').value = preset.separation;
    document.getElementById('alignment').value = preset.alignment;
    document.getElementById('cohesion').value = preset.cohesion;
    document.getElementById('neighborRadius').value = preset.neighborRadius;
    document.getElementById('maxSpeed').value = preset.maxSpeed;

    document.getElementById('sep-val').textContent = preset.separation;
    document.getElementById('ali-val').textContent = preset.alignment;
    document.getElementById('coh-val').textContent = preset.cohesion;
    document.getElementById('rad-val').textContent = preset.neighborRadius;
    document.getElementById('spd-val').textContent = preset.maxSpeed;

    state.activePreset = name;
    updatePresetLabel();
}

function updatePresetLabel() {
    const label = document.getElementById('preset-label');
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));

    if (state.activePreset) {
        label.textContent = state.activePreset.charAt(0).toUpperCase() + state.activePreset.slice(1);
        const activeBtn = document.querySelector(`.preset-btn[data-preset="${state.activePreset}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    } else {
        label.textContent = 'Custom';
    }
}

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

// Reset defaults
document.getElementById('reset-params-btn').addEventListener('click', () => {
    state.params.separation = DEFAULTS.separation;
    state.params.alignment = DEFAULTS.alignment;
    state.params.cohesion = DEFAULTS.cohesion;
    state.params.neighborRadius = DEFAULTS.neighborRadius;
    state.params.maxSpeed = DEFAULTS.maxSpeed;

    document.getElementById('separation').value = DEFAULTS.separation;
    document.getElementById('alignment').value = DEFAULTS.alignment;
    document.getElementById('cohesion').value = DEFAULTS.cohesion;
    document.getElementById('neighborRadius').value = DEFAULTS.neighborRadius;
    document.getElementById('maxSpeed').value = DEFAULTS.maxSpeed;

    document.getElementById('sep-val').textContent = DEFAULTS.separation;
    document.getElementById('ali-val').textContent = DEFAULTS.alignment;
    document.getElementById('coh-val').textContent = DEFAULTS.cohesion;
    document.getElementById('rad-val').textContent = DEFAULTS.neighborRadius;
    document.getElementById('spd-val').textContent = DEFAULTS.maxSpeed;

    state.activePreset = null;
    updatePresetLabel();
});

// Boundary toggle
document.getElementById('wrap-btn').addEventListener('click', () => {
    state.params.boundaryMode = 'wrap';
    document.getElementById('wrap-btn').classList.add('active');
    document.getElementById('bounce-btn').classList.remove('active');
});
document.getElementById('bounce-btn').addEventListener('click', () => {
    state.params.boundaryMode = 'bounce';
    document.getElementById('bounce-btn').classList.add('active');
    document.getElementById('wrap-btn').classList.remove('active');
});

// Pause / Reset
const pauseBtn = document.getElementById('pause-btn');
pauseBtn.addEventListener('click', togglePause);

function togglePause() {
    state.ui.paused = !state.ui.paused;
    pauseBtn.textContent = state.ui.paused ? '⏵ Play' : '⏸ Pause';
}

document.getElementById('reset-btn').addEventListener('click', () => {
    spawnBoids();
    state.predators = [];
    updatePredatorCount();
    for (const b of state.boids) b.trail = [];
});

// Keyboard
document.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
        e.preventDefault();
        togglePause();
    }
});

// Predators
document.querySelectorAll('.add-predator-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        state.predators.push(createPredator(btn.dataset.type));
        updatePredatorCount();
    });
});

document.getElementById('clear-predators-btn').addEventListener('click', () => {
    state.predators = [];
    updatePredatorCount();
});

function updatePredatorCount() {
    const counts = { hawk: 0, snake: 0, shark: 0 };
    for (const p of state.predators) counts[p.type]++;

    const parts = [];
    if (counts.hawk) parts.push(counts.hawk + ' hawk' + (counts.hawk > 1 ? 's' : ''));
    if (counts.snake) parts.push(counts.snake + ' snake' + (counts.snake > 1 ? 's' : ''));
    if (counts.shark) parts.push(counts.shark + ' shark' + (counts.shark > 1 ? 's' : ''));

    document.getElementById('predator-count').textContent = parts.length ? parts.join(', ') : 'No predators';
}

// Canvas click to select boid or place predator
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Select nearest boid for vision cone
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < state.boids.length; i++) {
        const b = state.boids[i];
        const d = mag(b.x - x, b.y - y);
        if (d < minDist) {
            minDist = d;
            nearest = i;
        }
    }
    state.ui.selectedBoid = nearest;
});

// Themes
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        state.ui.theme = theme;

        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.body.className = '';
        if (theme !== 'minimal') {
            document.body.classList.add('theme-' + theme);
        }
    });
});

// ── Start ─────────────────────────────────────────────────────
requestAnimationFrame(gameLoop);
