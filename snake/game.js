// Game Constants
const GRID_SIZE = 20;
const CELL_SIZE = 25;
const BASE_SPEED = 150;

// Colors
const COLORS = {
    player: '#00ffff',
    ai: ['#ff00ff', '#ff6600', '#00ff00', '#9900ff', '#ff0066'],
    food: '#ffd700',
    goldenFood: '#fff',
    shrinkFood: '#ff4444',
    grid: '#1a1a3a',
    background: '#0a0a1a'
};

// Power-up types
const POWER_UPS = {
    speed: { color: '#00aaff', duration: 5000, icon: '⚡' },
    ghost: { color: '#aaaaff', duration: 3000, icon: '👻' },
    magnet: { color: '#9900ff', duration: 4000, icon: '🧲' },
    shield: { color: '#ffd700', duration: Infinity, icon: '🛡️' }
};

// AI Behaviors
const AI_BEHAVIORS = ['cautious', 'aggressive', 'wanderer', 'hunter', 'optimizer'];

// Game State
let canvas, ctx;
let gameState = 'MENU';
let settings = {
    aiCount: 2,
    sound: true,
    grid: true,
    particles: true
};

let player, aiSnakes, foods, powerUps, particles;
let score, highScore, gameSpeed, foodCollected;
let activePowerUps = {};
let directionQueue = [];
let lastUpdate = 0;
let animationId;

// Audio Context
let audioCtx;

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    canvas.width = GRID_SIZE * CELL_SIZE;
    canvas.height = GRID_SIZE * CELL_SIZE;

    highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
    document.getElementById('high-score').textContent = highScore;

    setupEventListeners();
    showScreen('menu');
}

function setupEventListeners() {
    // Slider
    const slider = document.getElementById('ai-slider');
    const countDisplay = document.getElementById('ai-count');
    slider.addEventListener('input', () => {
        settings.aiCount = parseInt(slider.value);
        countDisplay.textContent = settings.aiCount;
    });

    // Toggles
    document.querySelectorAll('.toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const setting = btn.dataset.setting;
            const value = btn.dataset.value === 'on';
            settings[setting] = value;

            btn.parentElement.querySelectorAll('.toggle').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            playSound('click');
        });
    });

    // Buttons
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('restart-btn').addEventListener('click', startGame);
    document.getElementById('settings-btn').addEventListener('click', () => showScreen('menu'));
    document.getElementById('play-again-btn').addEventListener('click', startGame);
    document.getElementById('menu-btn').addEventListener('click', () => showScreen('menu'));

    // Keyboard
    document.addEventListener('keydown', handleKeydown);

    // Touch
    let touchStartX, touchStartY;
    canvas.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });
    canvas.addEventListener('touchend', e => {
        if (!touchStartX || !touchStartY) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;

        if (Math.abs(dx) > Math.abs(dy)) {
            queueDirection(dx > 0 ? 'right' : 'left');
        } else {
            queueDirection(dy > 0 ? 'down' : 'up');
        }
    });
}

function handleKeydown(e) {
    if (gameState === 'MENU') return;

    switch(e.key) {
        case 'ArrowUp': case 'w': case 'W':
            queueDirection('up'); break;
        case 'ArrowDown': case 's': case 'S':
            queueDirection('down'); break;
        case 'ArrowLeft': case 'a': case 'A':
            queueDirection('left'); break;
        case 'ArrowRight': case 'd': case 'D':
            queueDirection('right'); break;
        case ' ':
            e.preventDefault();
            togglePause(); break;
        case 'r': case 'R':
            startGame(); break;
        case 'm': case 'M':
            settings.sound = !settings.sound; break;
    }
}

function queueDirection(dir) {
    if (gameState !== 'PLAYING') return;

    const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
    const lastDir = directionQueue.length > 0 ? directionQueue[directionQueue.length - 1] : player.direction;

    if (dir !== opposites[lastDir] && directionQueue.length < 3) {
        directionQueue.push(dir);
    }
}

function showScreen(screen) {
    document.getElementById('menu-screen').classList.toggle('hidden', screen !== 'menu');
    document.getElementById('game-screen').classList.toggle('hidden', screen !== 'game');

    if (screen === 'menu') {
        gameState = 'MENU';
        cancelAnimationFrame(animationId);
    }
}

function startGame() {
    showScreen('game');
    gameState = 'PLAYING';

    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('gameover-overlay').classList.add('hidden');

    // Reset game state
    score = 0;
    foodCollected = 0;
    gameSpeed = BASE_SPEED;
    activePowerUps = {};
    directionQueue = [];
    particles = [];

    // Create player
    player = createSnake(Math.floor(GRID_SIZE / 2), Math.floor(GRID_SIZE / 2), COLORS.player);

    // Create AI snakes
    aiSnakes = [];
    for (let i = 0; i < settings.aiCount; i++) {
        const x = Math.floor(Math.random() * (GRID_SIZE - 4)) + 2;
        const y = Math.floor(Math.random() * (GRID_SIZE - 4)) + 2;
        const snake = createSnake(x, y, COLORS.ai[i]);
        snake.behavior = AI_BEHAVIORS[i % AI_BEHAVIORS.length];
        snake.isAI = true;
        aiSnakes.push(snake);
    }

    // Create initial food
    foods = [];
    powerUps = [];
    spawnFood();
    spawnFood();

    updateHUD();
    lastUpdate = performance.now();
    gameLoop();
}

function createSnake(x, y, color) {
    return {
        segments: [
            { x, y },
            { x: x - 1, y },
            { x: x - 2, y }
        ],
        direction: 'right',
        color,
        alive: true,
        hasShield: false
    };
}

function spawnFood() {
    let x, y;
    do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * GRID_SIZE);
    } while (isOccupied(x, y));

    const rand = Math.random();
    let type = 'regular';
    if (rand < 0.1) type = 'golden';
    else if (rand < 0.15) type = 'shrink';

    const food = { x, y, type };

    if (type === 'golden') {
        food.expireTime = performance.now() + 5000;
    }

    foods.push(food);

    // Chance to spawn power-up
    if (Math.random() < 0.15) {
        spawnPowerUp();
    }
}

function spawnPowerUp() {
    let x, y;
    do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * GRID_SIZE);
    } while (isOccupied(x, y));

    const types = Object.keys(POWER_UPS);
    const type = types[Math.floor(Math.random() * types.length)];

    powerUps.push({ x, y, type });
}

function isOccupied(x, y) {
    // Check player
    if (player && player.segments.some(s => s.x === x && s.y === y)) return true;

    // Check AI
    if (aiSnakes) {
        for (const ai of aiSnakes) {
            if (ai.segments.some(s => s.x === x && s.y === y)) return true;
        }
    }

    // Check food
    if (foods && foods.some(f => f.x === x && f.y === y)) return true;

    // Check power-ups
    if (powerUps && powerUps.some(p => p.x === x && p.y === y)) return true;

    return false;
}

function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        document.getElementById('pause-overlay').classList.remove('hidden');
        playSound('click');
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        document.getElementById('pause-overlay').classList.add('hidden');
        lastUpdate = performance.now();
        gameLoop();
    }
}

function gameLoop(timestamp = 0) {
    if (gameState !== 'PLAYING') return;

    animationId = requestAnimationFrame(gameLoop);

    // Update logic at fixed timestep
    if (timestamp - lastUpdate >= gameSpeed) {
        update();
        lastUpdate = timestamp;
    }

    // Render at 60fps
    render();
}

function update() {
    // Process direction queue
    if (directionQueue.length > 0) {
        player.direction = directionQueue.shift();
    }

    // Move player
    moveSnake(player);

    // Move AI
    for (const ai of aiSnakes) {
        if (ai.alive) {
            updateAI(ai);
            moveSnake(ai);
        }
    }

    // Check collisions
    checkCollisions();

    // Update power-ups
    updatePowerUps();

    // Check expired golden food
    const now = performance.now();
    foods = foods.filter(f => !f.expireTime || f.expireTime > now);

    // Update particles
    if (settings.particles) {
        particles = particles.filter(p => {
            p.life -= 0.02;
            p.x += p.vx;
            p.y += p.vy;
            return p.life > 0;
        });
    }
}

function moveSnake(snake) {
    if (!snake.alive) return;

    const head = { ...snake.segments[0] };

    switch(snake.direction) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
    }

    // Apply magnet effect for player
    if (activePowerUps.magnet && !snake.isAI) {
        for (const food of foods) {
            const dx = head.x - food.x;
            const dy = head.y - food.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 5 && dist > 0) {
                food.x += Math.sign(dx);
                food.y += Math.sign(dy);
            }
        }
    }

    snake.segments.unshift(head);
    snake.segments.pop();
}

function updateAI(ai) {
    const head = ai.segments[0];
    let targetX, targetY;

    // Find nearest food
    let nearestFood = null;
    let minDist = Infinity;
    for (const food of foods) {
        const dist = Math.abs(food.x - head.x) + Math.abs(food.y - head.y);
        if (dist < minDist) {
            minDist = dist;
            nearestFood = food;
        }
    }

    switch(ai.behavior) {
        case 'cautious':
            // Avoid edges, go for food if safe
            if (nearestFood && head.x > 2 && head.x < GRID_SIZE - 3 && head.y > 2 && head.y < GRID_SIZE - 3) {
                targetX = nearestFood.x;
                targetY = nearestFood.y;
            } else {
                targetX = GRID_SIZE / 2;
                targetY = GRID_SIZE / 2;
            }
            break;

        case 'aggressive':
            // Target food near player
            targetX = nearestFood ? nearestFood.x : player.segments[0].x;
            targetY = nearestFood ? nearestFood.y : player.segments[0].y;
            break;

        case 'wanderer':
            // Random movement
            if (Math.random() < 0.3) {
                const dirs = ['up', 'down', 'left', 'right'];
                ai.direction = dirs[Math.floor(Math.random() * dirs.length)];
                return;
            }
            targetX = nearestFood ? nearestFood.x : head.x;
            targetY = nearestFood ? nearestFood.y : head.y;
            break;

        case 'hunter':
            // Try to cut off player
            const playerHead = player.segments[0];
            targetX = playerHead.x + (player.direction === 'right' ? 3 : player.direction === 'left' ? -3 : 0);
            targetY = playerHead.y + (player.direction === 'down' ? 3 : player.direction === 'up' ? -3 : 0);
            break;

        case 'optimizer':
            // Shortest path to food
            targetX = nearestFood ? nearestFood.x : head.x;
            targetY = nearestFood ? nearestFood.y : head.y;
            break;
    }

    // Simple pathfinding
    const dx = targetX - head.x;
    const dy = targetY - head.y;

    const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' };
    let possibleDirs = [];

    if (dx > 0 && ai.direction !== 'left') possibleDirs.push('right');
    if (dx < 0 && ai.direction !== 'right') possibleDirs.push('left');
    if (dy > 0 && ai.direction !== 'up') possibleDirs.push('down');
    if (dy < 0 && ai.direction !== 'down') possibleDirs.push('up');

    // Filter out dangerous directions
    possibleDirs = possibleDirs.filter(dir => {
        let testX = head.x, testY = head.y;
        switch(dir) {
            case 'up': testY--; break;
            case 'down': testY++; break;
            case 'left': testX--; break;
            case 'right': testX++; break;
        }

        // Check walls
        if (testX < 0 || testX >= GRID_SIZE || testY < 0 || testY >= GRID_SIZE) return false;

        // Check self collision
        if (ai.segments.some(s => s.x === testX && s.y === testY)) return false;

        return true;
    });

    if (possibleDirs.length > 0) {
        ai.direction = possibleDirs[0];
    }
}

function checkCollisions() {
    const head = player.segments[0];

    // Wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        handleDeath();
        return;
    }

    // Self collision (unless ghost mode)
    if (!activePowerUps.ghost) {
        for (let i = 1; i < player.segments.length; i++) {
            if (head.x === player.segments[i].x && head.y === player.segments[i].y) {
                handleDeath();
                return;
            }
        }
    }

    // AI collision
    for (const ai of aiSnakes) {
        if (!ai.alive) continue;

        for (const segment of ai.segments) {
            if (head.x === segment.x && head.y === segment.y) {
                if (player.hasShield) {
                    player.hasShield = false;
                    playSound('shield');
                } else {
                    handleDeath();
                    return;
                }
            }
        }

        // Check AI deaths
        const aiHead = ai.segments[0];

        // AI wall collision
        if (aiHead.x < 0 || aiHead.x >= GRID_SIZE || aiHead.y < 0 || aiHead.y >= GRID_SIZE) {
            ai.alive = false;
            spawnParticles(aiHead.x * CELL_SIZE, aiHead.y * CELL_SIZE, ai.color);
            continue;
        }

        // AI self collision
        for (let i = 1; i < ai.segments.length; i++) {
            if (aiHead.x === ai.segments[i].x && aiHead.y === ai.segments[i].y) {
                ai.alive = false;
                spawnParticles(aiHead.x * CELL_SIZE, aiHead.y * CELL_SIZE, ai.color);
                break;
            }
        }

        // AI collides with player
        for (const segment of player.segments) {
            if (aiHead.x === segment.x && aiHead.y === segment.y) {
                ai.alive = false;
                score += 100;
                spawnParticles(aiHead.x * CELL_SIZE, aiHead.y * CELL_SIZE, ai.color);
                break;
            }
        }
    }

    // Food collision
    for (let i = foods.length - 1; i >= 0; i--) {
        const food = foods[i];
        if (head.x === food.x && head.y === food.y) {
            collectFood(food, i);
        }

        // AI food collision
        for (const ai of aiSnakes) {
            if (ai.alive) {
                const aiHead = ai.segments[0];
                if (aiHead.x === food.x && aiHead.y === food.y) {
                    foods.splice(i, 1);
                    ai.segments.push({ ...ai.segments[ai.segments.length - 1] });
                    spawnFood();
                    break;
                }
            }
        }
    }

    // Power-up collision
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const pu = powerUps[i];
        if (head.x === pu.x && head.y === pu.y) {
            collectPowerUp(pu, i);
        }
    }
}

function collectFood(food, index) {
    foods.splice(index, 1);

    let points = 10;
    let growth = 1;

    switch(food.type) {
        case 'golden':
            points = 50;
            growth = 2;
            break;
        case 'shrink':
            points = 0;
            growth = -3;
            break;
    }

    score += points;
    foodCollected++;

    // Grow or shrink
    if (growth > 0) {
        for (let i = 0; i < growth; i++) {
            player.segments.push({ ...player.segments[player.segments.length - 1] });
        }
    } else if (growth < 0 && player.segments.length > 3) {
        player.segments.splice(player.segments.length + growth);
        if (player.segments.length < 3) player.segments.length = 3;
    }

    // Speed increase every 5 food
    if (foodCollected % 5 === 0) {
        gameSpeed = Math.max(50, gameSpeed * 0.95);
    }

    spawnFood();
    spawnParticles(food.x * CELL_SIZE + CELL_SIZE / 2, food.y * CELL_SIZE + CELL_SIZE / 2, COLORS.food);
    playSound('eat');
    updateHUD();
}

function collectPowerUp(pu, index) {
    powerUps.splice(index, 1);

    const powerUp = POWER_UPS[pu.type];

    if (pu.type === 'shield') {
        player.hasShield = true;
    } else {
        activePowerUps[pu.type] = performance.now() + powerUp.duration;
    }

    if (pu.type === 'speed') {
        gameSpeed *= 0.5;
    }

    spawnParticles(pu.x * CELL_SIZE + CELL_SIZE / 2, pu.y * CELL_SIZE + CELL_SIZE / 2, powerUp.color);
    playSound('powerup');
    updatePowerUpDisplay();
}

function updatePowerUps() {
    const now = performance.now();

    for (const type in activePowerUps) {
        if (now > activePowerUps[type]) {
            if (type === 'speed') {
                gameSpeed *= 2;
            }
            delete activePowerUps[type];
            updatePowerUpDisplay();
        }
    }
}

function updatePowerUpDisplay() {
    const display = document.getElementById('power-up-display');
    display.innerHTML = '';

    for (const type in activePowerUps) {
        const powerUp = POWER_UPS[type];
        const remaining = Math.ceil((activePowerUps[type] - performance.now()) / 1000);

        const div = document.createElement('div');
        div.className = 'power-up-indicator';
        div.style.borderColor = powerUp.color;
        div.style.color = powerUp.color;
        div.textContent = `${powerUp.icon} ${remaining}s`;
        display.appendChild(div);
    }

    if (player && player.hasShield) {
        const div = document.createElement('div');
        div.className = 'power-up-indicator';
        div.style.borderColor = POWER_UPS.shield.color;
        div.style.color = POWER_UPS.shield.color;
        div.textContent = `${POWER_UPS.shield.icon} SHIELD`;
        display.appendChild(div);
    }
}

function handleDeath() {
    if (player.hasShield) {
        player.hasShield = false;
        playSound('shield');
        return;
    }

    gameState = 'GAME_OVER';
    cancelAnimationFrame(animationId);

    spawnParticles(player.segments[0].x * CELL_SIZE, player.segments[0].y * CELL_SIZE, player.color);
    playSound('death');

    // Update high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        document.getElementById('new-high').classList.remove('hidden');
    } else {
        document.getElementById('new-high').classList.add('hidden');
    }

    document.getElementById('final-score').textContent = score;
    document.getElementById('final-length').textContent = player.segments.length;
    document.getElementById('gameover-overlay').classList.remove('hidden');
}

function spawnParticles(x, y, color) {
    if (!settings.particles) return;

    for (let i = 0; i < 15; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            color,
            life: 1
        });
    }
}

function updateHUD() {
    document.getElementById('score').textContent = score;
    document.getElementById('high-score').textContent = highScore;
    document.getElementById('length').textContent = player.segments.length;
}

function render() {
    // Clear
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    if (settings.grid) {
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        for (let i = 0; i <= GRID_SIZE; i++) {
            ctx.beginPath();
            ctx.moveTo(i * CELL_SIZE, 0);
            ctx.lineTo(i * CELL_SIZE, canvas.height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i * CELL_SIZE);
            ctx.lineTo(canvas.width, i * CELL_SIZE);
            ctx.stroke();
        }
    }

    // Power-ups
    for (const pu of powerUps) {
        const powerUp = POWER_UPS[pu.type];
        ctx.fillStyle = powerUp.color;
        ctx.shadowColor = powerUp.color;
        ctx.shadowBlur = 15;
        ctx.font = `${CELL_SIZE - 4}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerUp.icon, pu.x * CELL_SIZE + CELL_SIZE / 2, pu.y * CELL_SIZE + CELL_SIZE / 2);
        ctx.shadowBlur = 0;
    }

    // Food
    for (const food of foods) {
        let color = COLORS.food;
        if (food.type === 'golden') color = COLORS.goldenFood;
        if (food.type === 'shrink') color = COLORS.shrinkFood;

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(
            food.x * CELL_SIZE + CELL_SIZE / 2,
            food.y * CELL_SIZE + CELL_SIZE / 2,
            CELL_SIZE / 3,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // AI Snakes
    for (const ai of aiSnakes) {
        if (ai.alive) {
            renderSnake(ai);
        }
    }

    // Player
    if (player) {
        renderSnake(player, activePowerUps.ghost);
    }

    // Particles
    for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function renderSnake(snake, isGhost = false) {
    ctx.shadowColor = snake.color;
    ctx.shadowBlur = 10;

    for (let i = snake.segments.length - 1; i >= 0; i--) {
        const segment = snake.segments[i];
        const isHead = i === 0;

        ctx.fillStyle = snake.color;
        ctx.globalAlpha = isGhost ? 0.5 : 1;

        if (snake.hasShield && isHead) {
            ctx.shadowColor = POWER_UPS.shield.color;
            ctx.shadowBlur = 20;
        }

        const size = isHead ? CELL_SIZE - 2 : CELL_SIZE - 4;
        const offset = isHead ? 1 : 2;

        ctx.beginPath();
        ctx.roundRect(
            segment.x * CELL_SIZE + offset,
            segment.y * CELL_SIZE + offset,
            size,
            size,
            isHead ? 6 : 4
        );
        ctx.fill();

        // Eyes on head
        if (isHead) {
            ctx.fillStyle = '#000';
            ctx.shadowBlur = 0;

            let eyeOffsetX = 0, eyeOffsetY = 0;
            switch(snake.direction) {
                case 'up': eyeOffsetY = -3; break;
                case 'down': eyeOffsetY = 3; break;
                case 'left': eyeOffsetX = -3; break;
                case 'right': eyeOffsetX = 3; break;
            }

            ctx.beginPath();
            ctx.arc(
                segment.x * CELL_SIZE + CELL_SIZE / 2 - 4 + eyeOffsetX,
                segment.y * CELL_SIZE + CELL_SIZE / 2 - 2 + eyeOffsetY,
                2, 0, Math.PI * 2
            );
            ctx.arc(
                segment.x * CELL_SIZE + CELL_SIZE / 2 + 4 + eyeOffsetX,
                segment.y * CELL_SIZE + CELL_SIZE / 2 - 2 + eyeOffsetY,
                2, 0, Math.PI * 2
            );
            ctx.fill();
        }
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

// Audio
function playSound(type) {
    if (!settings.sound) return;

    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    switch(type) {
        case 'eat':
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
            break;

        case 'powerup':
            osc.frequency.setValueAtTime(523, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1047, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2);
            break;

        case 'death':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
            break;

        case 'click':
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.05);
            break;

        case 'shield':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
            break;
    }
}
