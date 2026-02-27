'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
// SPIKE JUMPER  ·  Full Build
// Features: [1] Core  [2] Theming  [3] Boss  [4] Level Editor  [5] Ghost  [6] Rhythm
// ═══════════════════════════════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

let W, H, GROUND_Y;
const PLAYER_X = 140;

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  GROUND_Y = Math.round(H * 0.82);
}
window.addEventListener('resize', resize);
resize();
const GRAVITY   = 0.54;
const JUMP_FORCE= -13.2;
const HOLD_BONUS= -0.38;
const HOLD_MAX  = 18;
const BASE_SPEED= 4.8;
const SPEED_RAMP= 0.00050;

// ─────────────────────────────────────────────────────────────────────────────
// [2] BIOMES
// ─────────────────────────────────────────────────────────────────────────────
// Colors as [r,g,b] for smooth lerping
const BIOMES = [
  { name:'FOREST', th:0,
    skyA:[13,27,42],   skyB:[30,58,95],
    gnd:[31,107,31],   grs:[61,168,61],
    spk:[192,57,43],   wal:[90,106,122],  stars:true  },
  { name:'CAVE',   th:2500,
    skyA:[8,5,3],      skyB:[18,12,6],
    gnd:[55,35,18],    grs:[80,55,30],
    spk:[155,89,182],  wal:[80,60,40],    stars:false },
  { name:'SKY',    th:6000,
    skyA:[85,153,204], skyB:[136,187,238],
    gnd:[170,196,240], grs:[200,221,255],
    spk:[231,76,60],   wal:[119,136,153], stars:false },
  { name:'SPACE',  th:11000,
    skyA:[0,0,5],      skyB:[0,0,18],
    gnd:[26,0,48],     grs:[42,0,96],
    spk:[0,255,204],   wal:[42,26,58],    stars:true  },
];
const BIOME_FADE = 500;

function lerpRgb(a, b, t) {
  return [
    Math.round(a[0]+(b[0]-a[0])*t),
    Math.round(a[1]+(b[1]-a[1])*t),
    Math.round(a[2]+(b[2]-a[2])*t),
  ];
}
function rgb(a)      { return `rgb(${a[0]},${a[1]},${a[2]})`; }
function rgba(a, al) { return `rgba(${a[0]},${a[1]},${a[2]},${al})`; }
function biomeColor(prop) {
  const c = BIOMES[biomeIdx];
  const n = BIOMES[Math.min(biomeIdx+1, BIOMES.length-1)];
  return lerpRgb(c[prop], n[prop], biomeT);
}

// ─────────────────────────────────────────────────────────────────────────────
// [3] BOSS CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const BOSS_INTERVAL   = 7500;
const BOSS_WARN_FRAMES= 90;
// Boss chunks — include unique laser & wave hazard types
const BOSS_CHUNKS = [
  { w:600, obs:[{t:'wall',rx:100,w:18,h:90},{t:'spike',rx:250,w:28,h:30},{t:'wall',rx:390,w:18,h:80},{t:'spike',rx:520,w:28,h:30}] },
  { w:700, obs:[{t:'pit', rx:160,w:90},{t:'spike',rx:340,w:28,h:30},{t:'pit', rx:490,w:90},{t:'wall',rx:630,w:18,h:70}] },
  { w:650, obs:[{t:'wall',rx:120,w:18,h:60},{t:'wall',rx:300,w:18,h:90},{t:'wall',rx:480,w:18,h:60}] },
  { w:700, obs:[{t:'laser',rx:150,w:500,laserSpeed:1.2}] },        // sweeping laser
  { w:700, obs:[{t:'wave', rx:200,count:4,spacing:110}] },         // projectile wave
];

// ─────────────────────────────────────────────────────────────────────────────
// [4] LEVEL EDITOR CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const ED_COLS = 20, ED_TILE = 40, ED_ROWS = 4;
const TILE_TYPES  = ['empty','spike','wall_s','wall_t','pit'];
const TILE_LABELS = { empty:'', spike:'▲', wall_s:'▌S', wall_t:'▌T', pit:'□' };
const TILE_COLORS = { empty:'#1a2a3a', spike:'#c0392b', wall_s:'#5a6a7a', wall_t:'#3d4d5d', pit:'#111' };

// ─────────────────────────────────────────────────────────────────────────────
// [6] RHYTHM CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const BEAT_MS = (60 / 128) * 1000; // ~128 BPM
const BEATS   = Array.from({ length: 512 }, (_, i) => 800 + i * BEAT_MS);

// ─────────────────────────────────────────────────────────────────────────────
// CHUNK LIBRARY
// ─────────────────────────────────────────────────────────────────────────────
// Obstacles start at rx >= 300. Empty chunks give breathing room between hazards.
const CHUNKS_NORMAL = [
  {w:520, obs:[{t:'spike',rx:360,w:28,h:30}]},
  {w:540, obs:[{t:'spike',rx:380,w:28,h:30}]},
  {w:500, obs:[{t:'wall', rx:320,w:18,h:52}]},
  {w:520, obs:[{t:'wall', rx:340,w:18,h:78}]},
  {w:560, obs:[{t:'pit',  rx:310,w:88}]},
  {w:580, obs:[{t:'wall', rx:420,w:18,h:58}]},
  {w:580, obs:[{t:'spike',rx:360,w:28,h:30}]},
  {w:600, obs:[{t:'pit',  rx:320,w:78}]},
  {w:700, obs:[]},   // breathing gap
  {w:800, obs:[]},   // long breathing gap
];
const CHUNKS_HARD = [
  {w:580, obs:[{t:'wall', rx:310,w:18,h:90},{t:'spike',rx:460,w:28,h:30}]},
  {w:620, obs:[{t:'pit',  rx:300,w:108},{t:'wall',rx:490,w:18,h:66}]},
  {w:560, obs:[{t:'pit',  rx:310,w:84}]},
  {w:560, obs:[{t:'wall', rx:310,w:18,h:62},{t:'wall',rx:450,w:18,h:82}]},
  {w:600, obs:[{t:'spike',rx:310,w:24,h:26},{t:'wall',rx:460,w:18,h:70}]},
];

// ─────────────────────────────────────────────────────────────────────────────
// GAME STATE  (all mutable vars)
// ─────────────────────────────────────────────────────────────────────────────
// Seeded RNG — Xorshift32.  Same seed → same obstacle sequence every run.
let gameSeed        = 1;
let _rng            = 1;
let obstacleSchedule= [];   // all pre-generated obstacles for this run
let scheduleIdx     = 0;    // next obstacle to stream into the active array

function seededRand() {
  _rng ^= _rng << 13; _rng ^= _rng >> 17; _rng ^= _rng << 5;
  return (_rng >>> 0) / 0xffffffff;
}

// Pre-generate the full run using the current gameSeed.
// Forces an empty breathing chunk after every hazard chunk so spikes
// never appear back-to-back.
function pregenSchedule() {
  obstacleSchedule = []; scheduleIdx = 0;
  let wx = 900; _rng = gameSeed;
  let needBreather = false;
  for (let i = 0; i < 220; i++) {
    let c;
    if (needBreather && seededRand() < 0.55) {
      // ~55% chance of a breathing gap after a hazard chunk
      const empties = CHUNKS_NORMAL.filter(ch => ch.obs.length === 0);
      c = empties.length ? empties[Math.floor(seededRand()*empties.length)] : {w:650,obs:[]};
      needBreather = false;
    } else {
      needBreather = false;
      const pool = i > 45 ? [...CHUNKS_NORMAL,...CHUNKS_HARD] : CHUNKS_NORMAL;
      c = pool[Math.floor(seededRand()*pool.length)];
      if (c.obs.length > 0) needBreather = true;
    }
    for (const o of c.obs) obstacleSchedule.push({t:o.t, worldX:wx+o.rx, w:o.w||88, h:o.h||0});
    wx += c.w;
  }
  nextChunkWX = wx;  // boss system still needs this
}

let state     = 'title';
let distance  = 0;
let score     = 0;
let combo     = 0;
let speed     = BASE_SPEED;
let frame     = 0;
let highScore = +localStorage.getItem('sj_hi') || 0;
let flash     = { alpha:0, r:0, g:0, b:0 };

// Biome state
let biomeIdx      = 0;
let biomeT        = 0;
let prevBiomeIdx  = 0;
let biomeNameTimer= 0;

// Boss state
let bossState  = 'idle'; // 'idle'|'warning'|'active'|'reward'
let bossTimer  = 0;
let bossNextAt = BOSS_INTERVAL;
let bossReward = 0;
let invincible = 0;   // countdown frames of post-boss invincibility
let breatherFrames = 0; // speed reduction breather after boss

// Editor state
let editorOpen     = false;
let editorGrid     = Array.from({length:ED_ROWS}, () => Array(ED_COLS).fill('empty'));
let editorMsg      = '';
let editorMsgTimer = 0;
let editorPlaytest = false;
let ptSavedState   = null;
let editorUndo     = [];      // stack of grid snapshots for undo
let editorRedo     = [];      // stack for redo

// Ghost state  (up to 3 simultaneous ghosts)
const GHOST_TINTS   = ['#00e5ff','#ff00cc','#aaff00'];
const GHOST_SLOTS   = ['sj_ghost_0','sj_ghost_1','sj_ghost_2'];
let ghostEvents     = [];
let ghostData       = null;   // kept for single-ghost compat (slot 0)
let ghostState      = null;
let ghostsList      = [];     // [{data, state, tint}, ...]
let ghostSlotNext   = 0;      // which slot the next saved run goes into

// Rhythm state — off by default; press M in-game to toggle
let rhythmActive    = false;
let rhythmStartTime = 0;
let rhythmBeatIdx   = 0;
let rhythmFeedback  = { text:'', timer:0, color:'#fff' };
let rhythmMult      = 1.0;   // score multiplier from last rhythm rating (decays to 1)
let ytPlayer        = null;
let ytReady         = false;

// Player
const P = {
  y:GROUND_Y, vy:0, w:28, h:42,
  onGround:true, holdFrames:0, wasAirborne:false,
  squish:1.0, legPhase:0,
};

// Obstacles
let obstacles   = [];
let nextChunkWX = 900;

// Input
let jumpHeld    = false;
let jumpPressed = false;

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function toScreen(wx)      { return wx - distance; }
function playerFeetWX()    { return distance + PLAYER_X + P.w/2; }
function isOverPit(fx)     { return obstacles.some(o=>o.t==='pit'&&fx>o.worldX&&fx<o.worldX+o.w); }
function overlaps(a,b)     { return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y; }
function playerHitbox()    { return {x:PLAYER_X+5, y:P.y-P.h+8, w:P.w-10, h:P.h-8}; }

// ─────────────────────────────────────────────────────────────────────────────
// CHUNK SPAWNING
// ─────────────────────────────────────────────────────────────────────────────
function pickChunk() {
  const pool = speed>=9 ? [...CHUNKS_NORMAL,...CHUNKS_HARD] : CHUNKS_NORMAL;
  return pool[Math.floor(seededRand()*pool.length)];
}
function spawnChunk() {
  const c = pickChunk();
  for (const o of c.obs) obstacles.push({t:o.t, worldX:nextChunkWX+o.rx, w:o.w||88, h:o.h||0});
  nextChunkWX += c.w;
}

// ─────────────────────────────────────────────────────────────────────────────
// [2] BIOME UPDATE
// ─────────────────────────────────────────────────────────────────────────────
function updateBiome() {
  let idx = 0;
  for (let i=BIOMES.length-1; i>=0; i--) {
    if (distance >= BIOMES[i].th) { idx=i; break; }
  }
  if (idx !== prevBiomeIdx) { biomeNameTimer=180; prevBiomeIdx=idx; }
  biomeIdx = idx;
  const nextIdx = Math.min(idx+1, BIOMES.length-1);
  const nextTh  = BIOMES[nextIdx].th;
  biomeT = idx>=BIOMES.length-1 ? 0
    : Math.max(0, Math.min(1, (distance-(nextTh-BIOME_FADE))/BIOME_FADE));
  if (biomeNameTimer>0) biomeNameTimer--;
}

// ─────────────────────────────────────────────────────────────────────────────
// [3] BOSS UPDATE
// ─────────────────────────────────────────────────────────────────────────────
function startBoss() {
  bossState = 'warning';
  bossTimer = BOSS_WARN_FRAMES;
  const chunk   = BOSS_CHUNKS[Math.floor(Math.random()*BOSS_CHUNKS.length)];
  const startWX = nextChunkWX + 300;
  for (const o of chunk.obs) {
    obstacles.push({t:o.t, worldX:startWX+o.rx, w:o.w||88, h:o.h||0, isBoss:true});
  }
  nextChunkWX = startWX + chunk.w;
}
function updateBoss() {
  if (bossState==='idle') { if (distance>=bossNextAt) startBoss(); return; }
  bossTimer--;
  if (bossState==='warning' && bossTimer<=0) { bossState='active'; bossTimer=300; }
  if (bossState==='active') {
    const bossObs = obstacles.filter(o=>o.isBoss);
    if (bossTimer<=0 || bossObs.every(o=>toScreen(o.worldX)<PLAYER_X-50)) {
      bossState='reward'; bossTimer=120; bossReward=5000; score+=bossReward;
      bossNextAt = distance+BOSS_INTERVAL;
      invincible = 180;      // 3 s at 60 fps
      breatherFrames = 180;  // speed eases back over 3 s
    }
  }
  if (bossState==='reward' && bossTimer<=0) bossState='idle';
  if (invincible>0) invincible--;
  if (breatherFrames>0) { speed = Math.max(speed-0.04, BASE_SPEED); breatherFrames--; }
}

// ─────────────────────────────────────────────────────────────────────────────
// [5] GHOST RACING
// ─────────────────────────────────────────────────────────────────────────────
function ghostInit() {
  ghostEvents = [];
  ghostsList = [];
  // URL param injects a shared ghost into slot 0
  const urlParam = new URLSearchParams(location.search).get('ghost');
  if (urlParam) {
    try { const d=JSON.parse(atob(urlParam)); if(d) localStorage.setItem(GHOST_SLOTS[0], JSON.stringify(d)); } catch(e){}
  }
  for (let i=0; i<GHOST_SLOTS.length; i++) {
    const raw = localStorage.getItem(GHOST_SLOTS[i]);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      ghostsList.push({ data, tint:GHOST_TINTS[i], state:{y:GROUND_Y,vy:0,onGround:true,evtIdx:0,frame:0} });
    } catch(e){}
  }
  // Legacy compat — keep ghostData/ghostState pointing at first ghost
  ghostData  = ghostsList[0]?.data  || null;
  ghostState = ghostsList[0]?.state || null;
}

function ghostSaveSlot() {
  if (ghostEvents.length<1) return;
  ghostEvents.push({f:frame, type:'death', score});
  const data = JSON.stringify({seed:gameSeed, score, events:ghostEvents});
  localStorage.setItem(GHOST_SLOTS[ghostSlotNext % GHOST_SLOTS.length], data);
  ghostSlotNext = (ghostSlotNext+1) % GHOST_SLOTS.length;
}

function ghostShareURL() {
  const raw = localStorage.getItem(GHOST_SLOTS[0]);
  if (!raw) return null;
  return location.origin + location.pathname + '?ghost=' + btoa(raw);
}
function ghostRecord(type) { ghostEvents.push({f:frame, type}); }
function ghostSave() { ghostSaveSlot(); }  // alias
function updateGhost() {
  for (let gi=ghostsList.length-1; gi>=0; gi--) {
    const g = ghostsList[gi];
    if (!g.state) continue;
    g.state.frame++;
    while (g.state.evtIdx < g.data.events.length) {
      const evt = g.data.events[g.state.evtIdx];
      if (evt.f > g.state.frame) break;
      if (evt.type==='jump' && g.state.onGround) { g.state.vy=JUMP_FORCE; g.state.onGround=false; }
      if (evt.type==='death') { g.state=null; break; }
      g.state.evtIdx++;
    }
    if (!g.state) continue;
    g.state.vy = Math.min(g.state.vy+GRAVITY, 18);
    g.state.y  += g.state.vy;
    if (g.state.y >= GROUND_Y) { g.state.y=GROUND_Y; g.state.vy=0; g.state.onGround=true; }
  }
  // keep legacy alias in sync
  ghostState = ghostsList[0]?.state || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// [6] RHYTHM RUNNER
// ─────────────────────────────────────────────────────────────────────────────
function loadYouTube() {
  if (document.getElementById('yt-api-script')) return;
  const s = document.createElement('script');
  s.id  = 'yt-api-script';
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
}
let pendingMusic = false;
window.onYouTubeIframeAPIReady = function() {
  ytPlayer = new YT.Player('yt-player', {
    videoId: 'UQh7eFnmhpA',
    width: 200, height: 200,
    playerVars: { autoplay: 0, controls: 0, playlist: 'UQh7eFnmhpA', mute: 0 },
    events: {
      onReady: () => {
        ytReady = true;
        if (pendingMusic) { ytPlayer.playVideo(); pendingMusic = false; }
      },
      onStateChange: (e) => { if (e.data===YT.PlayerState.ENDED && ytPlayer) { ytPlayer.seekTo(0); ytPlayer.playVideo(); } }
    }
  });
};
function startMusic() {
  // Music plays unless user has muted via the button
  rhythmStartTime = performance.now();
  rhythmBeatIdx = 0;
  if (_musicMuted) return;
  if (ytReady && ytPlayer) {
    ytPlayer.playVideo();
  } else {
    pendingMusic = true;
  }
}
function stopMusic()  { if (ytReady && ytPlayer) ytPlayer.pauseVideo(); rhythmActive=false; }

function updateRhythm() {
  if (!rhythmActive) return;
  if (rhythmFeedback.timer>0) rhythmFeedback.timer--;
  const elapsed = performance.now()-rhythmStartTime;
  while (rhythmBeatIdx<BEATS.length && BEATS[rhythmBeatIdx]<=elapsed+1400) {
    const beatTime    = BEATS[rhythmBeatIdx];
    const framesAhead = Math.max(0, (beatTime-elapsed)/1000*60);
    if (framesAhead>0) {
      const wx = distance+PLAYER_X+framesAhead*speed+200;
      obstacles.push({t:'spike', worldX:wx, w:28, h:30, beatTime});
    }
    rhythmBeatIdx++;
  }
}
function checkRhythmJump() {
  if (!rhythmActive) return;
  const elapsed = performance.now()-rhythmStartTime;
  let nearestDelta = Infinity;
  for (const bt of BEATS) { const d=Math.abs(bt-elapsed); if (d<nearestDelta) nearestDelta=d; }
  if      (nearestDelta<=30) {
    rhythmFeedback={text:'PERFECT!',timer:50,color:'#f1c40f'}; rhythmMult=3.0;
    flash={alpha:0.18,r:255,g:210,b:0};
  } else if (nearestDelta<=80) {
    rhythmFeedback={text:'GOOD',    timer:40,color:'#ecf0f1'}; rhythmMult=1.5;
    flash={alpha:0.08,r:255,g:255,b:255};
  } else {
    rhythmFeedback={text:'MISS',    timer:40,color:'#e74c3c'}; rhythmMult=0; combo=Math.max(0,combo-1);
    flash={alpha:0.22,r:220,g:30,b:30};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// [4] LEVEL EDITOR
// ─────────────────────────────────────────────────────────────────────────────
function editorSnapGrid() { return editorGrid.map(r=>[...r]); }

function editorClick(mx, my) {
  const col = Math.floor(mx/ED_TILE);
  const row = Math.floor((my-44)/ED_TILE);
  if (col<0||col>=ED_COLS||row!==ED_ROWS-1) return;
  editorUndo.push(editorSnapGrid()); editorRedo=[];
  const cur = TILE_TYPES.indexOf(editorGrid[ED_ROWS-1][col]);
  editorGrid[ED_ROWS-1][col] = TILE_TYPES[(cur+1)%TILE_TYPES.length];
}
function editorSaveChunk() {
  const obs = [];
  for (let c=0; c<ED_COLS; c++) {
    const t = editorGrid[ED_ROWS-1][c];
    if (t==='empty') continue;
    const type = t.startsWith('wall') ? 'wall' : t;
    const h    = t==='wall_t' ? 80 : t==='wall_s' ? 52 : 30;
    const w    = t.startsWith('wall') ? 18 : 28;
    obs.push({t:type, rx:c*ED_TILE, w, h});
  }
  if (obs.length===0) { editorMsg='Nothing to save!'; editorMsgTimer=90; return; }

  // Completability check
  const maxJumpH  = Math.abs(JUMP_FORCE) * Math.abs(JUMP_FORCE) / (2 * GRAVITY);   // v²/2g
  const maxJumpDist = (BASE_SPEED * 2 * Math.abs(JUMP_FORCE)) / GRAVITY;            // range at base speed
  let warn = '';
  for (const o of obs) {
    if (o.t==='wall'  && o.h > maxJumpH)      warn=`Wall at col ${(o.rx/ED_TILE)|0} too tall (${o.h}px > ${maxJumpH|0}px)!`;
    if (o.t==='pit'   && o.w > maxJumpDist)   warn=`Pit at col ${(o.rx/ED_TILE)|0} too wide (${o.w}px > ${maxJumpDist|0}px)!`;
  }
  if (warn) { editorMsg='⚠ '+warn; editorMsgTimer=180; return; }

  CHUNKS_NORMAL.push({w:ED_COLS*ED_TILE, obs});
  editorMsg=`Saved! ${obs.length} obstacle(s) — chunk is completable.`;
  editorMsgTimer=120;
}

function startEditorPlaytest() {
  const obs = [];
  for (let c=0; c<ED_COLS; c++) {
    const t = editorGrid[ED_ROWS-1][c];
    if (t==='empty') continue;
    const type = t.startsWith('wall') ? 'wall' : t;
    const h = t==='wall_t' ? 80 : t==='wall_s' ? 52 : 30;
    const w = t.startsWith('wall') ? 18 : 28;
    obs.push({t:type, worldX:900+c*ED_TILE, w, h});
  }
  if (obs.length===0) { editorMsg='Place some obstacles first!'; editorMsgTimer=90; return; }
  // snapshot current game state
  ptSavedState = { state, distance, score, combo, speed, frame,
    obstacles:[...obstacles], nextChunkWX, Py:P.y, Pvy:P.vy,
    PonGround:P.onGround, PwasAirborne:P.wasAirborne, Psquish:P.squish };
  // set up isolated playtest run
  state='playing'; distance=0; score=0; combo=0; speed=BASE_SPEED; frame=0;
  P.y=GROUND_Y; P.vy=0; P.onGround=true; P.wasAirborne=false; P.squish=1; P.legPhase=0;
  obstacles=obs; nextChunkWX=900+ED_COLS*ED_TILE+600;
  jumpHeld=false; jumpPressed=false;
  flash={alpha:0,r:0,g:0,b:0};
  editorPlaytest=true; editorOpen=false;
}

function stopEditorPlaytest() {
  if (!ptSavedState) { editorPlaytest=false; editorOpen=true; return; }
  const s=ptSavedState;
  state=s.state; distance=s.distance; score=s.score; combo=s.combo;
  speed=s.speed; frame=s.frame; obstacles=s.obstacles; nextChunkWX=s.nextChunkWX;
  P.y=s.Py; P.vy=s.Pvy; P.onGround=s.PonGround; P.wasAirborne=s.PwasAirborne; P.squish=s.Psquish;
  ptSavedState=null; editorPlaytest=false; editorOpen=true;
}

canvas.addEventListener('click', e => {
  if (!editorOpen) return;
  const r  = canvas.getBoundingClientRect();
  const sx = W/r.width, sy = H/r.height;
  editorClick((e.clientX-r.left)*sx, (e.clientY-r.top)*sy);
});

// ─────────────────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (e.code==='Space'||e.code==='ArrowUp') {
    e.preventDefault();
    if (!jumpHeld) jumpPressed=true;
    jumpHeld=true;
    if (state!=='playing') restartGame();
  }
  if ((e.code==='Enter'||e.code==='KeyR') && state!=='playing') restartGame();
  if (e.code==='KeyM' && state==='playing') {
    rhythmActive=!rhythmActive;
    rhythmStartTime=performance.now(); rhythmBeatIdx=0;
  }
  if (e.code==='KeyG' && state==='dead') {
    const url=ghostShareURL();
    if (url) navigator.clipboard.writeText(url).catch(()=>{});
  }
  if (e.code==='KeyE' && !editorPlaytest) editorOpen=!editorOpen;
  if (e.code==='KeyX' && editorOpen && !editorPlaytest) editorSaveChunk();
  if (e.code==='KeyP' && editorOpen && !editorPlaytest) startEditorPlaytest();
  if (e.code==='KeyZ' && editorOpen) {
    if (editorUndo.length) { editorRedo.push(editorSnapGrid()); editorGrid=editorUndo.pop(); }
  }
  if (e.code==='KeyY' && editorOpen) {
    if (editorRedo.length) { editorUndo.push(editorSnapGrid()); editorGrid=editorRedo.pop(); }
  }
  if (e.code==='Escape') {
    if (editorPlaytest) stopEditorPlaytest();
    else if (editorOpen) editorOpen=false;
  }
});
window.addEventListener('keyup', e => { if (e.code==='Space'||e.code==='ArrowUp') jumpHeld=false; });
canvas.addEventListener('mousedown', () => {
  if (editorOpen) return;
  if (!jumpHeld) jumpPressed=true;
  jumpHeld=true;
  if (state!=='playing') restartGame();
});
canvas.addEventListener('mouseup', () => { jumpHeld=false; });
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (!jumpHeld) jumpPressed=true; jumpHeld=true;
  if (state!=='playing') restartGame();
}, {passive:false});
canvas.addEventListener('touchend', e => { e.preventDefault(); jumpHeld=false; }, {passive:false});

// ─────────────────────────────────────────────────────────────────────────────
// CORE UPDATE
// ─────────────────────────────────────────────────────────────────────────────
function update() {
  if (state!=='playing') return;
  frame++;
  speed    = BASE_SPEED+frame*SPEED_RAMP;
  distance += speed;
  updateBiome();
  updateBoss();
  updateGhost();
  updateRhythm();
  updateParticles();

  // Stream in pre-generated obstacles as the player approaches them
  while (scheduleIdx < obstacleSchedule.length &&
         obstacleSchedule[scheduleIdx].worldX - distance < W + 600) {
    obstacles.push({...obstacleSchedule[scheduleIdx++]});
  }
  obstacles = obstacles.filter(o=>toScreen(o.worldX+(o.w||0))>-200);

  if (jumpPressed) {
    if (P.onGround) {
      P.vy=JUMP_FORCE; P.onGround=false; P.holdFrames=0; P.wasAirborne=true;
      ghostRecord('jump');
      checkRhythmJump();
      // Retry music on every jump — each jump IS a user gesture, so this
      // beats the browser autoplay restriction even if API loaded late.
      if (ytReady && ytPlayer && ytPlayer.getPlayerState() !== 1) ytPlayer.playVideo();
    }
    jumpPressed=false;
  }
  if (jumpHeld&&!P.onGround&&P.holdFrames<HOLD_MAX) { P.vy+=HOLD_BONUS; P.holdFrames++; }

  P.vy = Math.min(P.vy+GRAVITY, 18);
  P.y += P.vy;

  if (!isOverPit(playerFeetWX())&&P.y>=GROUND_Y) {
    if (P.wasAirborne) { P.wasAirborne=false; P.squish=0.58; combo++; }
    P.y=GROUND_Y; P.vy=0; P.onGround=true; P.holdFrames=0;
  }
  if (P.y>H+60) { die(); return; }

  P.squish   += (1-P.squish)*0.22;
  P.legPhase  = P.onGround ? (P.legPhase+speed*0.12)%(Math.PI*2) : Math.PI*0.5;
  const rMult = rhythmActive ? Math.max(1, rhythmMult) : 1;
  score       = Math.floor(distance*0.1*(1+combo*0.15)*rMult);
  if (rhythmMult > 1) rhythmMult = Math.max(1, rhythmMult-0.008);
  flash.alpha = Math.max(0, flash.alpha-0.05);

  // Advance laser sweep and wave projectiles
  for (const obs of obstacles) {
    if (obs.t==='laser') {
      if (obs.laserY===undefined) obs.laserY=GROUND_Y*0.6;
      obs.laserY += (obs.laserDir||1) * (obs.laserSpeed||1.0);
      if (obs.laserY < GROUND_Y*0.12 || obs.laserY > GROUND_Y*0.80) obs.laserDir=(obs.laserDir||1)*-1;
    }
    if (obs.t==='wave' && obs.projectiles===undefined) {
      obs.projectiles=[];
      for (let k=0;k<(obs.count||4);k++) obs.projectiles.push({wx:obs.worldX+k*(obs.spacing||100), h:(k%3)*18+16});
    }
  }

  const ph = playerHitbox();
  for (const obs of obstacles) {
    const sx=toScreen(obs.worldX);
    if (sx>W+80||sx+obs.w<-10) continue;
    let hb=null;
    if (obs.t==='spike') hb={x:sx+5,  y:GROUND_Y-obs.h+8, w:obs.w-10, h:obs.h-8};
    if (obs.t==='wall')  hb={x:sx+1,  y:GROUND_Y-obs.h,   w:obs.w-2,  h:obs.h  };
    if (obs.t==='laser') {
      const lx=toScreen(obs.worldX); const lw=obs.w; const ly=obs.laserY||GROUND_Y*0.5;
      hb={x:lx, y:ly-5, w:lw, h:10};
    }
    if (obs.t==='wave' && obs.projectiles) {
      for (const p of obs.projectiles) {
        const px=toScreen(p.wx); if (px>W+10||px<-20) continue;
        const phb={x:px-6, y:GROUND_Y-p.h-22, w:14, h:22};
        if (overlaps(ph,phb)&&invincible<=0) { die(); return; }
      }
    }
    if (hb&&overlaps(ph,hb)&&invincible<=0) { die(); return; }
  }
}

function die() {
  if (state!=='playing') return;
  state='dead';
  if (score>highScore) { highScore=score; localStorage.setItem('sj_hi',highScore); }
  ghostSave();
  stopMusic();
  flash={alpha:0.65,r:220,g:50,b:50};
}

function restartGame() {
  state='playing'; distance=0; score=0; combo=0; speed=BASE_SPEED;
  frame=0; obstacles=[]; nextChunkWX=900;
  P.y=GROUND_Y; P.vy=0; P.onGround=true; P.holdFrames=0;
  P.wasAirborne=false; P.squish=1; P.legPhase=0;
  jumpHeld=false; jumpPressed=false;
  flash={alpha:0,r:0,g:0,b:0};
  biomeIdx=0; biomeT=0; prevBiomeIdx=0; biomeNameTimer=0;
  bossState='idle'; bossTimer=0; bossNextAt=BOSS_INTERVAL;
  invincible=0; breatherFrames=0;
  gameSeed = (Math.random()*0x7fffffff|0)||1;
  pregenSchedule();   // builds obstacleSchedule deterministically from gameSeed
  ghostInit();
  resetParticles();
  startMusic();
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW: Background (biome-aware)
// ─────────────────────────────────────────────────────────────────────────────
function drawBg() {
  const g = ctx.createLinearGradient(0,0,0,GROUND_Y);
  g.addColorStop(0, rgb(biomeColor('skyA')));
  g.addColorStop(1, rgb(biomeColor('skyB')));
  ctx.fillStyle=g; ctx.fillRect(0,0,W,GROUND_Y);
}

// ─────────────────────────────────────────────────────────────────────────────
// [2] PARALLAX LAYERS  (far 0.10× / mid 0.40× / near 0.80×, 4 biomes)
// ─────────────────────────────────────────────────────────────────────────────
const PX_SPEEDS = [0.10, 0.40, 0.80];
function _pxX(i, n, layer) {
  const WW = W + 400;
  return ((i * WW / n - (distance * PX_SPEEDS[layer]) % WW) % WW + WW) % WW - 200;
}
function drawParallax() {
  _pxBiome(biomeIdx, 1 - biomeT);
  if (biomeT > 0.02) _pxBiome(Math.min(biomeIdx + 1, BIOMES.length - 1), biomeT);
}
function _pxBiome(b, alpha) {
  if (alpha < 0.02) return;
  ctx.save(); ctx.globalAlpha = alpha;
  const GY = GROUND_Y;
  if (b === 0) {                                 // FOREST
    ctx.fillStyle='rgba(255,255,255,0.55)';      // stars
    for(let i=0;i<40;i++){const sx=((i*139+distance*0.04)%W+W)%W,sy=(i*71+(i%7)*13)%(GY*.6|0)+6;ctx.fillRect(sx,sy,i%4===0?1.5:1,1);}
    ctx.fillStyle='#0d1f3a';                     // far: distant hills
    for(let i=0;i<5;i++){const x=_pxX(i,5,0),h=55+(i*43)%50;ctx.beginPath();ctx.moveTo(x,GY);ctx.lineTo(x+90,GY-h);ctx.lineTo(x+180,GY);ctx.fill();}
    for(let i=0;i<8;i++){                        // mid: trees
      const x=_pxX(i,8,1),h=60+(i*31)%45;
      ctx.fillStyle='#3d1f00';ctx.fillRect(x+14,GY-h*.45,8,h*.45);
      ctx.fillStyle='#0f4a0f';ctx.beginPath();ctx.arc(x+18,GY-h*.65,h*.40,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='#1a6b1a';                     // near: bushes
    for(let i=0;i<11;i++){const x=_pxX(i,11,2),r=11+(i*17)%10;ctx.beginPath();ctx.arc(x+r,GY-r*.6,r,Math.PI,0);ctx.fill();}
  } else if (b === 1) {                          // CAVE
    ctx.fillStyle='#120800';                     // far: ceiling rock humps
    for(let i=0;i<6;i++){const x=_pxX(i,6,0);ctx.beginPath();ctx.arc(x+50,0,50+(i*29)%30,0,Math.PI);ctx.fill();}
    ctx.fillStyle='#2e1508';                     // mid: stalactites
    for(let i=0;i<10;i++){const x=_pxX(i,10,1),h=28+(i*41)%50;ctx.beginPath();ctx.moveTo(x-7,0);ctx.lineTo(x+7,0);ctx.lineTo(x,h);ctx.closePath();ctx.fill();}
    for(let i=0;i<8;i++){                        // near: stalagmites + glow mushrooms
      const x=_pxX(i,8,2),h=18+(i*23)%28;
      ctx.fillStyle='#4a2e12';ctx.beginPath();ctx.moveTo(x-5,GY);ctx.lineTo(x+5,GY);ctx.lineTo(x,GY-h);ctx.closePath();ctx.fill();
      if(i%3===0){ctx.fillStyle='rgba(160,80,255,0.5)';ctx.beginPath();ctx.arc(x,GY-h-5,5,0,Math.PI*2);ctx.fill();}
    }
  } else if (b === 2) {                          // SKY
    ctx.fillStyle='rgba(255,255,255,0.15)';      // far: large cloud banks
    for(let i=0;i<4;i++){const x=_pxX(i,4,0),y=50+(i*61)%(GY*.4|0);ctx.beginPath();ctx.arc(x+50,y,45,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+90,y+12,30,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+15,y+12,28,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='rgba(255,255,255,0.28)';      // mid: medium clouds
    for(let i=0;i<6;i++){const x=_pxX(i,6,1),y=35+(i*53)%(GY*.48|0);ctx.beginPath();ctx.arc(x+25,y,22,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x+45,y+8,15,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='rgba(255,255,255,0.48)';      // near: wispy clouds
    for(let i=0;i<8;i++){const x=_pxX(i,8,2),y=40+(i*47)%(GY*.55|0);ctx.beginPath();ctx.ellipse(x+20,y,20,8,0,0,Math.PI*2);ctx.fill();}
  } else {                                       // SPACE
    ctx.fillStyle='rgba(255,255,255,0.80)';      // stars
    for(let i=0;i<65;i++){const sx=((i*139+distance*0.04)%W+W)%W,sy=(i*71+(i%7)*13)%(GY-22)+6;ctx.fillRect(sx,sy,i%5===0?1.5:1,1);}
    for(let i=0;i<4;i++){                        // far: nebula blobs
      const x=_pxX(i,4,0),y=30+(i*79)%(GY*.75|0),r=55+(i*33)%55;
      const cols=['rgba(80,0,180,0.14)','rgba(0,100,180,0.12)','rgba(180,0,80,0.13)','rgba(0,180,120,0.11)'];
      const grd=ctx.createRadialGradient(x,y,0,x,y,r);grd.addColorStop(0,cols[i]);grd.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grd;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='rgba(90,70,50,0.75)';         // mid: asteroids
    for(let i=0;i<7;i++){const x=_pxX(i,7,1),y=20+(i*67)%(GY*.72|0);ctx.beginPath();ctx.arc(x,y,5+(i*13)%10,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='rgba(255,210,100,0.65)';      // near: space debris
    for(let i=0;i<12;i++){const x=_pxX(i,12,2),y=15+(i*53)%(GY*.85|0);ctx.fillRect(x,y,i%4===0?2:1,i%4===0?2:1);}
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW: Ground
// ─────────────────────────────────────────────────────────────────────────────
function drawGround() {
  const gndC=biomeColor('gnd'), grsC=biomeColor('grs');
  const pits=obstacles.filter(o=>o.t==='pit');
  let cursor=0;
  while (cursor<W) {
    let nPitSx=W, nPit=null;
    for (const p of pits) { const px=toScreen(p.worldX); if (px>=cursor&&px<nPitSx){nPitSx=px;nPit=p;} }
    const segEnd=Math.min(nPitSx,W);
    if (segEnd>cursor) {
      ctx.fillStyle=rgb(gndC); ctx.fillRect(cursor,GROUND_Y,segEnd-cursor,H-GROUND_Y);
      ctx.fillStyle=rgb(grsC); ctx.fillRect(cursor,GROUND_Y,segEnd-cursor,7);
      ctx.fillStyle=rgba(grsC,.55);
      for (let gx=cursor+4;gx<segEnd;gx+=12) { ctx.fillRect(gx,GROUND_Y-3,2,5); ctx.fillRect(gx+5,GROUND_Y-5,2,7); }
    }
    cursor = nPit ? nPitSx+nPit.w : W;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// [2] BIOME PARTICLES
// ─────────────────────────────────────────────────────────────────────────────
const MAX_PARTICLES = 60;
let particles = [];

function resetParticles() { particles = []; }

function spawnParticle() {
  const b = biomeIdx;
  const p = { x: Math.random()*W, y: Math.random()*GROUND_Y, life:0, maxLife:0, vx:0, vy:0, r:0, col:'' };
  if (b===0) { // fireflies: drift up slowly, yellow-green glow
    p.y = GROUND_Y - 20 - Math.random()*(GROUND_Y*0.5);
    p.vx=(Math.random()-.5)*0.4; p.vy=-0.15-Math.random()*0.2;
    p.maxLife=120+Math.random()*80; p.r=2; p.col='rgba(200,255,80,';
  } else if (b===1) { // embers: rise quickly, orange-red
    p.x=Math.random()*W; p.y=GROUND_Y-5;
    p.vx=(Math.random()-.5)*1.2; p.vy=-1.0-Math.random()*1.5;
    p.maxLife=40+Math.random()*40; p.r=1.5; p.col='rgba(255,120,30,';
  } else if (b===2) { // sparkles: drift sideways, white-cyan
    p.y=Math.random()*GROUND_Y*0.7+20;
    p.vx=-0.5-Math.random()*0.8; p.vy=(Math.random()-.5)*0.3;
    p.maxLife=80+Math.random()*60; p.r=1.5; p.col='rgba(180,240,255,';
  } else { // cosmic dust: drift slowly, purple-white
    p.vx=(Math.random()-.5)*0.3; p.vy=(Math.random()-.5)*0.3;
    p.maxLife=100+Math.random()*80; p.r=1; p.col='rgba(200,160,255,';
  }
  p.life = p.maxLife;
  particles.push(p);
}

function updateParticles() {
  if (state!=='playing') return;
  if (particles.length < MAX_PARTICLES && Math.random()<0.35) spawnParticle();
  for (let i=particles.length-1; i>=0; i--) {
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.life--;
    if (p.life<=0||p.x<-10||p.x>W+10||p.y<-10||p.y>GROUND_Y+10) { particles.splice(i,1); }
  }
}

function drawParticles() {
  for (const p of particles) {
    const a = (p.life/p.maxLife) * (p.life<20 ? p.life/20 : 1) * (1-biomeT+0.2);
    ctx.fillStyle = p.col + Math.min(0.9,a).toFixed(2)+')';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW: Obstacles
// ─────────────────────────────────────────────────────────────────────────────
function drawObstacles() {
  const spkC=biomeColor('spk'), walC=biomeColor('wal');
  for (const obs of obstacles) {
    const sx=toScreen(obs.worldX);
    if (sx>W+10||sx+obs.w<-10) continue;
    const boss=obs.isBoss;
    if (obs.t==='spike') {
      ctx.fillStyle = boss?'#ff00cc':rgb(spkC);
      ctx.beginPath(); ctx.moveTo(sx,GROUND_Y); ctx.lineTo(sx+obs.w/2,GROUND_Y-obs.h); ctx.lineTo(sx+obs.w,GROUND_Y); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.moveTo(sx+obs.w/2,GROUND_Y-obs.h); ctx.lineTo(sx+obs.w*.36,GROUND_Y-2); ctx.lineTo(sx+obs.w*.47,GROUND_Y-obs.h+5); ctx.closePath(); ctx.fill();
    } else if (obs.t==='laser') {
      const ly=obs.laserY||GROUND_Y*0.5;
      // glow
      ctx.save();
      ctx.shadowColor='#ff2200'; ctx.shadowBlur=18;
      ctx.strokeStyle='#ff4400'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(sx,ly); ctx.lineTo(sx+obs.w,ly); ctx.stroke();
      ctx.strokeStyle='rgba(255,180,0,0.6)'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(sx,ly); ctx.lineTo(sx+obs.w,ly); ctx.stroke();
      ctx.restore();
    } else if (obs.t==='wave' && obs.projectiles) {
      for (const p of obs.projectiles) {
        const px=toScreen(p.wx);
        if (px>W+10||px<-20) continue;
        ctx.fillStyle='#ff00cc';
        ctx.beginPath(); ctx.moveTo(px,GROUND_Y-p.h); ctx.lineTo(px-6,GROUND_Y); ctx.lineTo(px+6,GROUND_Y); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(255,200,255,0.4)';
        ctx.beginPath(); ctx.arc(px,GROUND_Y-p.h,5,0,Math.PI*2); ctx.fill();
      }
    } else if (obs.t==='wall') {
      ctx.fillStyle = boss?'#7700cc':rgb(walC);
      ctx.fillRect(sx,GROUND_Y-obs.h,obs.w,obs.h);
      ctx.strokeStyle='rgba(0,0,0,.28)'; ctx.lineWidth=1;
      for (let row=0; row*13<obs.h; row++) {
        const by=GROUND_Y-obs.h+row*13, off=(row%2)*8;
        ctx.beginPath(); ctx.moveTo(sx,by); ctx.lineTo(sx+obs.w,by); ctx.stroke();
        for (let c=off;c<obs.w;c+=16){ctx.beginPath();ctx.moveTo(sx+c,by);ctx.lineTo(sx+c,by+13);ctx.stroke();}
      }
      ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fillRect(sx,GROUND_Y-obs.h,obs.w,3);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW: Player (shared for player + ghost)
// ─────────────────────────────────────────────────────────────────────────────
function drawPlayerAt(px, py, alpha, running, sq, legPh) {
  const pw=P.w, ph=P.h;
  ctx.save(); ctx.globalAlpha=alpha;
  ctx.translate(px+pw/2,py); ctx.scale(1/sq,sq); ctx.translate(-(px+pw/2),-py);
  ctx.fillStyle='#e67e22'; ctx.fillRect(px,py-ph,pw,ph);
  ctx.fillStyle='#2c3e50'; ctx.fillRect(px+4,py-ph+5,pw-8,16);
  ctx.fillStyle='#00e5ff'; ctx.fillRect(px+5,py-ph+8,7,7); ctx.fillRect(px+pw-12,py-ph+8,7,7);
  ctx.fillStyle='#001a33'; ctx.fillRect(px+7,py-ph+10,3,3); ctx.fillRect(px+pw-10,py-ph+10,3,3);
  ctx.fillStyle='#d35400'; ctx.fillRect(px+pw-5,py-ph+22,5,ph-22);
  const l1=Math.sin(legPh)*5, l2=Math.sin(legPh+Math.PI)*5;
  ctx.fillStyle='#c0392b';
  if (running) { ctx.fillRect(px+2,py-12+l1,10,12); ctx.fillRect(px+pw-12,py-12+l2,10,12); }
  else         { ctx.fillRect(px+2,py-8,10,8);       ctx.fillRect(px+pw-12,py-8,10,8); }
  ctx.restore();
}
function drawPlayer() {
  drawPlayerAt(PLAYER_X,P.y,1,P.onGround,P.squish,P.legPhase);
  if (invincible>0) {
    const pulse = 0.5+0.5*Math.sin(frame*0.3);
    ctx.save();
    ctx.strokeStyle=`rgba(255,220,0,${0.4+0.5*pulse})`;
    ctx.lineWidth=2+pulse*2;
    ctx.beginPath(); ctx.arc(PLAYER_X+P.w/2, P.y-P.h/2, P.h*0.75+pulse*4, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
}
function drawGhost() {
  ghostsList.forEach((g, gi) => {
    if (!g.state) return;
    const ox = -8 - gi*6;
    drawPlayerAt(PLAYER_X+ox, g.state.y, 0.38, g.state.onGround, 1, frame*0.15);
    ctx.save(); ctx.globalAlpha=0.55;
    ctx.fillStyle=g.tint; ctx.font='10px monospace'; ctx.textAlign='center';
    ctx.fillText(`G${gi+1}`, PLAYER_X+ox+P.w/2, g.state.y-P.h-4);
    ctx.restore();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW: HUD
// ─────────────────────────────────────────────────────────────────────────────
function drawHUD() {
  ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,W,40);
  ctx.font='bold 18px "Courier New",monospace'; ctx.textBaseline='middle';
  ctx.fillStyle='#f1c40f'; ctx.textAlign='left';  ctx.fillText(`SCORE  ${score}`,14,20);
  ctx.fillStyle='#bdc3c7'; ctx.textAlign='center'; ctx.fillText(`BEST  ${highScore}`,W/2,20);
  if (combo>1) { ctx.fillStyle='#2ecc71'; ctx.textAlign='right'; ctx.fillText(`×${combo} COMBO`,W-14,20); }
  ctx.fillStyle='rgba(255,255,255,.3)'; ctx.font='12px monospace';
  ctx.textAlign='right'; ctx.textBaseline='bottom'; ctx.fillText(`SPD ${speed.toFixed(1)}`,W-8,H-4);
  if (rhythmActive) { ctx.fillStyle='rgba(241,196,15,0.7)'; ctx.fillText('♪ RHYTHM  [M off]',W-8,H-18); }
  ctx.textBaseline='alphabetic';
  // Biome banner
  if (biomeNameTimer>0) {
    ctx.save(); ctx.globalAlpha=Math.min(1,biomeNameTimer/30);
    ctx.fillStyle='#fff'; ctx.font='bold 18px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`— ${BIOMES[biomeIdx].name} —`, W/2, 58); ctx.restore();
  }
  // Rhythm feedback
  if (rhythmFeedback.timer>0) {
    ctx.save(); ctx.globalAlpha=rhythmFeedback.timer/50;
    ctx.fillStyle=rhythmFeedback.color; ctx.font='bold 26px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(rhythmFeedback.text, W/2, GROUND_Y/2); ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW: Boss overlay
// ─────────────────────────────────────────────────────────────────────────────
function drawBossUI() {
  if (bossState==='idle') return;
  if (bossState==='warning') {
    const p=Math.abs(Math.sin(bossTimer*.1));
    ctx.fillStyle=`rgba(160,0,0,${.12*p})`; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=`rgba(255,60,60,${p})`; ctx.font='bold 30px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⚠  BOSS INCOMING  ⚠',W/2,H/2);
  }
  if (bossState==='active') {
    ctx.fillStyle='rgba(160,0,0,.07)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,80,80,.75)'; ctx.font='bold 13px monospace';
    ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText('BOSS',8,46);
  }
  if (bossState==='reward') {
    ctx.save(); ctx.globalAlpha=bossTimer/120;
    ctx.fillStyle='#f1c40f'; ctx.font='bold 30px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(`SURVIVED!  +${bossReward}`,W/2,H/2);
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// [4] DRAW: Level Editor
// ─────────────────────────────────────────────────────────────────────────────
function drawEditor() {
  ctx.fillStyle='rgba(8,12,22,.95)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#f1c40f'; ctx.font='bold 14px monospace'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('LEVEL EDITOR  [click=place  X=save  P=playtest  Z=undo  Y=redo  Esc=close]',6,6);
  ctx.fillStyle='#888'; ctx.font='12px monospace';
  ctx.fillText('Types cycle: empty → spike ▲ → wall(S) → wall(T) → pit',6,24);

  for (let row=0; row<ED_ROWS; row++) {
    for (let col=0; col<ED_COLS; col++) {
      const tx=col*ED_TILE, ty=44+row*ED_TILE;
      const active = row===ED_ROWS-1;
      const type   = editorGrid[row][col];
      ctx.fillStyle = active ? TILE_COLORS[type] : '#0a1018';
      ctx.fillRect(tx,ty,ED_TILE-1,ED_TILE-1);
      ctx.strokeStyle='#1e2e3e'; ctx.lineWidth=1;
      ctx.strokeRect(tx,ty,ED_TILE-1,ED_TILE-1);
      if (active && type!=='empty') {
        ctx.fillStyle='#fff'; ctx.font='bold 13px monospace';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(TILE_LABELS[type], tx+ED_TILE/2, ty+ED_TILE/2);
      }
    }
  }
  // Ground indicator
  ctx.fillStyle='#3da83d'; ctx.fillRect(0, 44+ED_ROWS*ED_TILE, W, 5);
  // Message
  if (editorMsgTimer>0) {
    editorMsgTimer--;
    ctx.save(); ctx.globalAlpha=Math.min(1,editorMsgTimer/20);
    ctx.fillStyle='#2ecc71'; ctx.font='bold 14px monospace';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(editorMsg, W/2, 44+ED_ROWS*ED_TILE+10);
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW: Title / Game Over
// ─────────────────────────────────────────────────────────────────────────────
function drawTitle() {
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#050c18'); g.addColorStop(1,'#0d2a4a');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#3da83d'; ctx.fillRect(0,GROUND_Y,W,7);
  ctx.fillStyle='#1f6b1f'; ctx.fillRect(0,GROUND_Y+7,W,H-GROUND_Y-7);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.shadowColor='#f39c12'; ctx.shadowBlur=22;
  ctx.fillStyle='#f39c12'; ctx.font='bold 54px "Courier New",monospace';
  ctx.fillText('SPIKE JUMPER',W/2,H/2-50);
  ctx.shadowBlur=0;
  ctx.fillStyle='#ecf0f1'; ctx.font='20px "Courier New",monospace';
  ctx.fillText('Press SPACE or tap to start',W/2,H/2+8);
  ctx.fillStyle='#95a5a6'; ctx.font='14px "Courier New",monospace';
  ctx.fillText('Hold SPACE/↑ to jump higher  ·  E = Editor  ·  M = Rhythm mode',W/2,H/2+40);
  if (highScore>0) { ctx.fillStyle='#f1c40f'; ctx.fillText(`Best: ${highScore}`,W/2,H/2+72); }
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}

function drawDead() {
  ctx.fillStyle='rgba(0,0,0,.60)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='#e74c3c'; ctx.font='bold 44px "Courier New",monospace'; ctx.fillText('GAME OVER',W/2,H/2-38);
  ctx.fillStyle='#f1c40f'; ctx.font='bold 24px "Courier New",monospace'; ctx.fillText(`Score: ${score}`,W/2,H/2+4);
  if (score>0&&score>=highScore) { ctx.fillStyle='#2ecc71'; ctx.font='bold 16px "Courier New",monospace'; ctx.fillText('✦  NEW BEST  ✦',W/2,H/2+36); }
  ctx.fillStyle='#bdc3c7'; ctx.font='15px "Courier New",monospace'; ctx.fillText('SPACE · R · tap to restart',W/2,H/2+68);
  // Share button hint
  if (localStorage.getItem('sj_ghost')) {
    ctx.fillStyle='#27ae60'; ctx.font='13px "Courier New",monospace';
    ctx.fillText('[ G ] Copy race link to clipboard',W/2,H/2+96);
  }
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}

function drawFlash() {
  if (flash.alpha<=0) return;
  ctx.fillStyle=`rgba(${flash.r},${flash.g},${flash.b},${flash.alpha})`;
  ctx.fillRect(0,0,W,H);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LOOP
// ─────────────────────────────────────────────────────────────────────────────
function loop() {
  update();
  ctx.clearRect(0,0,W,H);
  if (editorOpen) {
    drawEditor();
  } else if (editorPlaytest) {
    drawBg(); drawParallax(); drawGround(); drawParticles(); drawObstacles(); drawPlayer(); drawHUD(); drawFlash();
    ctx.save(); ctx.fillStyle='rgba(0,180,120,0.18)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#00e5ff'; ctx.font='bold 14px monospace'; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText('PLAYTEST MODE  —  Esc to return to editor', W/2, 46); ctx.restore();
    if (state==='dead') {
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#e74c3c'; ctx.font='bold 24px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('CHUNK FAILED — Esc to edit', W/2, H/2);
    }
  } else if (state==='title') {
    drawTitle();
  } else {
    drawBg();
    drawParallax();
    drawGround();
    drawParticles();
    drawObstacles();
    drawGhost();
    drawPlayer();
    drawHUD();
    drawBossUI();
    drawFlash();
    if (state==='dead') drawDead();
  }
  requestAnimationFrame(loop);
}

let _musicMuted = false;  // kept so startMusic() reference doesn't break

loadYouTube();
requestAnimationFrame(loop);
