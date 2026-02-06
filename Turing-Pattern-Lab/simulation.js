// ===== Turing Pattern Lab - WebGL Simulation Engine =====

const Simulation = (() => {
  let gl, canvas;
  let simPrograms = {};
  let renderProgram;
  let quadVAO;
  let simFBOs = [null, null];
  let simTextures = [null, null];
  let downsampleFBO, downsampleTexture;
  let currentFBO = 0;
  let gridSize = 256;
  let running = true;
  let stepsPerFrame = 16;
  let frameCount = 0;
  let lastTime = performance.now();
  let fps = 0;
  let fpsFrames = 0;
  let fpsAccum = 0;

  // Current model & params
  let currentModel = 'gray-scott';
  let params = {};
  let currentPresetName = 'Turing Pattern';

  // Color map
  let currentColorMap = 'ocean';

  // Metrics for music engine
  let metrics = {
    coverage: 0, delta: 0, cluster_count: 0,
    symmetry: 0, edge_density: 0, center_of_mass: { x: 0.5, y: 0.5 }
  };
  let prevSample = null;

  // ===== MODEL DEFINITIONS =====
  const MODELS = {
    'gray-scott': {
      name: 'Gray-Scott',
      params: [
        { id: 'f', label: 'Feed rate (f)', min: 0.000, max: 0.100, default: 0.055, step: 0.001 },
        { id: 'k', label: 'Kill rate (k)', min: 0.000, max: 0.080, default: 0.062, step: 0.001 },
        { id: 'Du', label: 'Diffusion U', min: 0.05, max: 1.00, default: 0.21, step: 0.01 },
        { id: 'Dv', label: 'Diffusion V', min: 0.01, max: 0.50, default: 0.10, step: 0.01 },
        { id: 'dt', label: 'Timestep', min: 0.1, max: 2.0, default: 1.0, step: 0.1 }
      ],
      presets: [
        { name: 'Turing Pattern', f: 0.028, k: 0.062, desc: 'Classic Turing pattern — self-replicating spots.' },
        { name: 'Coral', f: 0.062, k: 0.063, desc: 'Branching, coral-like growth.' },
        { name: 'Worms', f: 0.078, k: 0.061, desc: 'Writhing, worm-like stripes.' },
        { name: 'Maze', f: 0.029, k: 0.057, desc: 'Dense labyrinthine patterns.' },
        { name: 'Holes', f: 0.039, k: 0.058, desc: 'Negative-space spots.' },
        { name: 'Chaos', f: 0.026, k: 0.051, desc: 'Unstable, constantly shifting.' },
        { name: 'Ripple', f: 0.014, k: 0.045, desc: 'Concentric expanding rings.' },
        { name: 'Spots', f: 0.030, k: 0.062, desc: 'Stable Turing spots (leopard-print).' },
        { name: 'Stripes', f: 0.042, k: 0.059, desc: 'Parallel stripe formation.' }
      ],
      info: `<p>The <strong>Gray-Scott model</strong> simulates two chemicals (U and V) that diffuse across a surface and react with each other. Chemical U is continuously fed into the system, while both chemicals are removed at a rate determined by the "kill" parameter.</p>
<p>The equations are:</p>
<p><code>∂U/∂t = Du·∇²U - U·V² + f·(1-U)</code></p>
<p><code>∂V/∂t = Dv·∇²V + U·V² - (f+k)·V</code></p>
<p><strong>f (feed rate)</strong> controls how quickly chemical U is replenished. Higher values push the system toward uniform states.</p>
<p><strong>k (kill rate)</strong> controls how quickly chemical V is removed. The interplay of f and k determines which patterns emerge.</p>
<p><strong>Du, Dv</strong> are diffusion rates. V typically diffuses slower than U, which is what creates the instability that forms patterns.</p>`
    },
    'fitzhugh-nagumo': {
      name: 'Fitzhugh-Nagumo',
      params: [
        { id: 'epsilon', label: 'Epsilon (ε)', min: 0.001, max: 0.100, default: 0.020, step: 0.001 },
        { id: 'a0', label: 'a₀', min: -0.50, max: 0.50, default: -0.005, step: 0.005 },
        { id: 'a1', label: 'a₁', min: 0.10, max: 5.00, default: 2.00, step: 0.10 },
        { id: 'Du', label: 'Diffusion U', min: 0.05, max: 2.00, default: 1.00, step: 0.05 },
        { id: 'Dv', label: 'Diffusion V', min: 0.01, max: 1.00, default: 0.50, step: 0.01 },
        { id: 'dt', label: 'Timestep', min: 0.01, max: 0.50, default: 0.10, step: 0.01 }
      ],
      presets: [
        { name: 'Spirals', epsilon: 0.020, a0: -0.005, a1: 2.00, desc: 'Classic rotating spiral waves.' },
        { name: 'Target Waves', epsilon: 0.020, a0: 0.100, a1: 2.00, desc: 'Concentric rings from excitation points.' },
        { name: 'Turbulence', epsilon: 0.010, a0: -0.100, a1: 1.50, desc: 'Chaotic spiral breakup.' },
        { name: 'Slow Pulse', epsilon: 0.050, a0: 0.000, a1: 3.00, desc: 'Slow, wide traveling pulses.' },
        { name: 'Fast Excitable', epsilon: 0.005, a0: 0.050, a1: 2.50, desc: 'Rapid, thin wave fronts.' }
      ],
      info: `<p>The <strong>Fitzhugh-Nagumo model</strong> simulates excitable media — originally a simplification of the Hodgkin-Huxley neuron model. It produces traveling waves, spirals, and excitation pulses.</p>
<p>The equations are:</p>
<p><code>∂u/∂t = Du·∇²u + u - u³ - v</code></p>
<p><code>∂v/∂t = Dv·∇²v + ε·(u - a₁·v - a₀)</code></p>
<p><strong>ε (epsilon)</strong> controls the timescale separation between u (fast activator) and v (slow inhibitor).</p>
<p><strong>a₀, a₁</strong> control the nullcline positions, determining whether the system is excitable, oscillatory, or bistable.</p>`
    },
    'schnakenberg': {
      name: 'Schnakenberg',
      params: [
        { id: 'a', label: 'a', min: 0.01, max: 0.50, default: 0.10, step: 0.01 },
        { id: 'b', label: 'b', min: 0.50, max: 2.00, default: 0.90, step: 0.01 },
        { id: 'gamma', label: 'Gamma (γ)', min: 10, max: 1000, default: 200, step: 10 },
        { id: 'Du', label: 'Diffusion U', min: 0.05, max: 2.00, default: 1.00, step: 0.05 },
        { id: 'Dv', label: 'Diffusion V', min: 5.0, max: 100.0, default: 40.0, step: 1.0 },
        { id: 'dt', label: 'Timestep', min: 0.0001, max: 0.01, default: 0.001, step: 0.0001 }
      ],
      presets: [
        { name: 'Hex Spots', a: 0.10, b: 0.90, gamma: 200, desc: 'Hexagonal array of spots.' },
        { name: 'Zebra Stripes', a: 0.05, b: 0.90, gamma: 500, desc: 'Regular parallel stripes.' },
        { name: 'Mixed', a: 0.08, b: 1.00, gamma: 300, desc: 'Spots transitioning to stripes.' },
        { name: 'Dense Dots', a: 0.12, b: 0.80, gamma: 800, desc: 'Tightly packed small spots.' },
        { name: 'Wide Bands', a: 0.04, b: 1.20, gamma: 150, desc: 'Broad, widely spaced stripes.' }
      ],
      info: `<p>The <strong>Schnakenberg model</strong> is a classic activator-inhibitor system with simpler kinetics than Gray-Scott. It produces clean spots, stripes, and mixed patterns with regular spacing.</p>
<p>The equations are:</p>
<p><code>∂u/∂t = Du·∇²u + γ·(a - u + u²·v)</code></p>
<p><code>∂v/∂t = Dv·∇²v + γ·(b - u²·v)</code></p>
<p><strong>a, b</strong> control the base production rates of the two chemicals.</p>
<p><strong>γ (gamma)</strong> scales the reaction speed relative to diffusion. Higher gamma produces more pattern features.</p>`
    }
  };

  // ===== COLOR MAPS =====
  const COLOR_MAPS = {
    monochrome: [[0,0,0],[255,255,255]],
    thermal: [[0,0,0],[180,0,0],[255,200,0],[255,255,255]],
    ocean: [[10,15,40],[0,80,120],[0,180,160],[200,240,230],[255,255,255]],
    neon: [[0,0,0],[80,0,120],[180,0,140],[255,50,150],[255,255,255]],
    earth: [[30,20,10],[80,70,30],[140,120,60],[200,180,120],[240,230,210]]
  };

  // ===== SHADERS =====
  const VERTEX_SHADER = `#version 300 es
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const GRAY_SCOTT_SHADER = `#version 300 es
    precision highp float;
    uniform sampler2D u_state;
    uniform vec2 u_texelSize;
    uniform float u_f, u_k, u_Du, u_Dv, u_dt;
    uniform int u_brushActive;
    uniform vec2 u_brushPos;
    uniform float u_brushRadius;
    uniform int u_brushErase;
    in vec2 v_uv;
    out vec4 fragColor;

    vec2 laplacian(sampler2D tex, vec2 uv, vec2 ts) {
      vec2 sum = vec2(0.0);
      // 3x3 weighted kernel
      sum += texture(tex, uv + vec2(-ts.x, -ts.y)).rg * 0.05;
      sum += texture(tex, uv + vec2(0.0, -ts.y)).rg * 0.2;
      sum += texture(tex, uv + vec2(ts.x, -ts.y)).rg * 0.05;
      sum += texture(tex, uv + vec2(-ts.x, 0.0)).rg * 0.2;
      sum += texture(tex, uv).rg * -1.0;
      sum += texture(tex, uv + vec2(ts.x, 0.0)).rg * 0.2;
      sum += texture(tex, uv + vec2(-ts.x, ts.y)).rg * 0.05;
      sum += texture(tex, uv + vec2(0.0, ts.y)).rg * 0.2;
      sum += texture(tex, uv + vec2(ts.x, ts.y)).rg * 0.05;
      return sum;
    }

    void main() {
      vec2 state = texture(u_state, v_uv).rg;
      float u = state.r;
      float v = state.g;

      vec2 lap = laplacian(u_state, v_uv, u_texelSize);
      float uvv = u * v * v;

      float du = u_Du * lap.r - uvv + u_f * (1.0 - u);
      float dv = u_Dv * lap.g + uvv - (u_f + u_k) * v;

      u += du * u_dt;
      v += dv * u_dt;

      // Brush interaction
      if (u_brushActive == 1) {
        float dist = length((v_uv - u_brushPos) * vec2(1.0));
        float brushNorm = u_brushRadius / float(textureSize(u_state, 0).x);
        if (dist < brushNorm) {
          if (u_brushErase == 1) {
            u = 1.0;
            v = 0.0;
          } else {
            v = 1.0;
          }
        }
      }

      u = clamp(u, 0.0, 1.0);
      v = clamp(v, 0.0, 1.0);
      fragColor = vec4(u, v, 0.0, 1.0);
    }
  `;

  const FITZHUGH_NAGUMO_SHADER = `#version 300 es
    precision highp float;
    uniform sampler2D u_state;
    uniform vec2 u_texelSize;
    uniform float u_epsilon, u_a0, u_a1, u_Du, u_Dv, u_dt;
    uniform int u_brushActive;
    uniform vec2 u_brushPos;
    uniform float u_brushRadius;
    uniform int u_brushErase;
    in vec2 v_uv;
    out vec4 fragColor;

    vec2 laplacian(sampler2D tex, vec2 uv, vec2 ts) {
      vec2 sum = vec2(0.0);
      sum += texture(tex, uv + vec2(-ts.x, -ts.y)).rg * 0.05;
      sum += texture(tex, uv + vec2(0.0, -ts.y)).rg * 0.2;
      sum += texture(tex, uv + vec2(ts.x, -ts.y)).rg * 0.05;
      sum += texture(tex, uv + vec2(-ts.x, 0.0)).rg * 0.2;
      sum += texture(tex, uv).rg * -1.0;
      sum += texture(tex, uv + vec2(ts.x, 0.0)).rg * 0.2;
      sum += texture(tex, uv + vec2(-ts.x, ts.y)).rg * 0.05;
      sum += texture(tex, uv + vec2(0.0, ts.y)).rg * 0.2;
      sum += texture(tex, uv + vec2(ts.x, ts.y)).rg * 0.05;
      return sum;
    }

    void main() {
      vec2 state = texture(u_state, v_uv).rg;
      float u = state.r;
      float v = state.g;

      vec2 lap = laplacian(u_state, v_uv, u_texelSize);

      float du = u_Du * lap.r + u - u*u*u - v;
      float dv = u_Dv * lap.g + u_epsilon * (u - u_a1 * v - u_a0);

      u += du * u_dt;
      v += dv * u_dt;

      // Brush
      if (u_brushActive == 1) {
        float dist = length((v_uv - u_brushPos) * vec2(1.0));
        float brushNorm = u_brushRadius / float(textureSize(u_state, 0).x);
        if (dist < brushNorm) {
          if (u_brushErase == 1) {
            u = 0.0; v = 0.0;
          } else {
            u = 1.0;
          }
        }
      }

      u = clamp(u, -2.0, 2.0);
      v = clamp(v, -2.0, 2.0);
      fragColor = vec4(u, v, 0.0, 1.0);
    }
  `;

  const SCHNAKENBERG_SHADER = `#version 300 es
    precision highp float;
    uniform sampler2D u_state;
    uniform vec2 u_texelSize;
    uniform float u_a, u_b, u_gamma, u_Du, u_Dv, u_dt;
    uniform int u_brushActive;
    uniform vec2 u_brushPos;
    uniform float u_brushRadius;
    uniform int u_brushErase;
    in vec2 v_uv;
    out vec4 fragColor;

    vec2 laplacian(sampler2D tex, vec2 uv, vec2 ts) {
      vec2 sum = vec2(0.0);
      sum += texture(tex, uv + vec2(-ts.x, -ts.y)).rg * 0.05;
      sum += texture(tex, uv + vec2(0.0, -ts.y)).rg * 0.2;
      sum += texture(tex, uv + vec2(ts.x, -ts.y)).rg * 0.05;
      sum += texture(tex, uv + vec2(-ts.x, 0.0)).rg * 0.2;
      sum += texture(tex, uv).rg * -1.0;
      sum += texture(tex, uv + vec2(ts.x, 0.0)).rg * 0.2;
      sum += texture(tex, uv + vec2(-ts.x, ts.y)).rg * 0.05;
      sum += texture(tex, uv + vec2(0.0, ts.y)).rg * 0.2;
      sum += texture(tex, uv + vec2(ts.x, ts.y)).rg * 0.05;
      return sum;
    }

    void main() {
      vec2 state = texture(u_state, v_uv).rg;
      float u = state.r;
      float v = state.g;

      vec2 lap = laplacian(u_state, v_uv, u_texelSize);

      float u2v = u * u * v;
      float du = u_Du * lap.r + u_gamma * (u_a - u + u2v);
      float dv = u_Dv * lap.g + u_gamma * (u_b - u2v);

      u += du * u_dt;
      v += dv * u_dt;

      // Brush
      if (u_brushActive == 1) {
        float dist = length((v_uv - u_brushPos) * vec2(1.0));
        float brushNorm = u_brushRadius / float(textureSize(u_state, 0).x);
        if (dist < brushNorm) {
          if (u_brushErase == 1) {
            float eq_u = u_a + u_b;
            float eq_v = u_b / (eq_u * eq_u);
            u = eq_u; v = eq_v;
          } else {
            u += 0.5;
          }
        }
      }

      u = clamp(u, 0.0, 10.0);
      v = clamp(v, 0.0, 10.0);
      fragColor = vec4(u, v, 0.0, 1.0);
    }
  `;

  const RENDER_SHADER = `#version 300 es
    precision highp float;
    uniform sampler2D u_state;
    uniform vec3 u_colorMap[5];
    uniform int u_colorMapSize;
    uniform float u_vMin;
    uniform float u_vMax;
    in vec2 v_uv;
    out vec4 fragColor;

    vec3 mapColor(float t) {
      t = clamp(t, 0.0, 1.0);
      float segments = float(u_colorMapSize - 1);
      float idx = t * segments;
      int i = int(floor(idx));
      float frac = fract(idx);
      if (i >= u_colorMapSize - 1) return u_colorMap[u_colorMapSize - 1];
      return mix(u_colorMap[i], u_colorMap[i + 1], frac);
    }

    void main() {
      float v = texture(u_state, v_uv).g;
      float t = (v - u_vMin) / (u_vMax - u_vMin);
      vec3 color = mapColor(t);

      // Vignette
      vec2 vig = v_uv * (1.0 - v_uv);
      float vigAmount = vig.x * vig.y * 15.0;
      vigAmount = clamp(pow(vigAmount, 0.25), 0.0, 1.0);
      color *= vigAmount;

      fragColor = vec4(color, 1.0);
    }
  `;

  // ===== WEBGL HELPERS =====
  function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(vertSrc, fragSrc) {
    const vert = compileShader(vertSrc, gl.VERTEX_SHADER);
    const frag = compileShader(fragSrc, gl.FRAGMENT_SHADER);
    if (!vert || !frag) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      return null;
    }
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return prog;
  }

  function createSimTexture(width, height, data) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
  }

  function createFBO(texture) {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return fbo;
  }

  // ===== INITIALIZATION =====
  function init(canvasEl) {
    canvas = canvasEl;
    gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) {
      document.getElementById('no-webgl').classList.remove('hidden');
      canvas.classList.add('hidden');
      return false;
    }

    // Check for float texture support
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
      console.warn('EXT_color_buffer_float not available, trying alternatives');
    }

    // Build shader programs
    simPrograms['gray-scott'] = createProgram(VERTEX_SHADER, GRAY_SCOTT_SHADER);
    simPrograms['fitzhugh-nagumo'] = createProgram(VERTEX_SHADER, FITZHUGH_NAGUMO_SHADER);
    simPrograms['schnakenberg'] = createProgram(VERTEX_SHADER, SCHNAKENBERG_SHADER);
    renderProgram = createProgram(VERTEX_SHADER, RENDER_SHADER);

    // Create quad VAO
    quadVAO = gl.createVertexArray();
    gl.bindVertexArray(quadVAO);
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    // Set attrib for all programs
    for (const key in simPrograms) {
      const prog = simPrograms[key];
      if (prog) {
        const loc = gl.getAttribLocation(prog, 'a_position');
        if (loc >= 0) {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        }
      }
    }
    if (renderProgram) {
      const loc = gl.getAttribLocation(renderProgram, 'a_position');
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      }
    }

    // Load default params
    loadModelDefaults();
    initGrid();
    setupDownsampleFBO();

    return true;
  }

  function loadModelDefaults() {
    const model = MODELS[currentModel];
    params = {};
    model.params.forEach(p => {
      params[p.id] = p.default;
    });
  }

  function initGrid() {
    const n = gridSize;
    const data = new Float32Array(n * n * 4);

    if (currentModel === 'gray-scott') {
      for (let i = 0; i < n * n; i++) {
        data[i * 4] = 1.0;     // U
        data[i * 4 + 1] = 0.0; // V
        data[i * 4 + 2] = 0.0;
        data[i * 4 + 3] = 1.0;
      }
      // Seed center region
      const cx = n / 2, cy = n / 2;
      const r = Math.max(4, n / 20);
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy < r * r) {
            const i = (y * n + x) * 4;
            data[i] = 0.5;
            data[i + 1] = 0.25;
          }
        }
      }
    } else if (currentModel === 'fitzhugh-nagumo') {
      for (let i = 0; i < n * n; i++) {
        data[i * 4] = 0.0;
        data[i * 4 + 1] = 0.0;
        data[i * 4 + 2] = 0.0;
        data[i * 4 + 3] = 1.0;
      }
    } else if (currentModel === 'schnakenberg') {
      const a = params.a || 0.10;
      const b = params.b || 0.90;
      const eq_u = a + b;
      const eq_v = b / (eq_u * eq_u);
      for (let i = 0; i < n * n; i++) {
        data[i * 4] = eq_u + (Math.random() - 0.5) * 0.01;
        data[i * 4 + 1] = eq_v + (Math.random() - 0.5) * 0.01;
        data[i * 4 + 2] = 0.0;
        data[i * 4 + 3] = 1.0;
      }
    }

    // Cleanup old textures/FBOs
    for (let i = 0; i < 2; i++) {
      if (simTextures[i]) gl.deleteTexture(simTextures[i]);
      if (simFBOs[i]) gl.deleteFramebuffer(simFBOs[i]);
    }

    simTextures[0] = createSimTexture(n, n, data);
    simTextures[1] = createSimTexture(n, n, data);
    simFBOs[0] = createFBO(simTextures[0]);
    simFBOs[1] = createFBO(simTextures[1]);
    currentFBO = 0;

    // Update canvas size
    canvas.width = n;
    canvas.height = n;
    resizeCanvas();
  }

  function setupDownsampleFBO() {
    if (downsampleTexture) gl.deleteTexture(downsampleTexture);
    if (downsampleFBO) gl.deleteFramebuffer(downsampleFBO);
    downsampleTexture = createSimTexture(64, 64, null);
    downsampleFBO = createFBO(downsampleTexture);
  }

  function resizeCanvas() {
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth - 20, container.clientHeight - 20);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
  }

  // ===== SIMULATION STEP =====
  function simStep(brushActive, brushPos, brushRadius, brushErase) {
    const prog = simPrograms[currentModel];
    if (!prog) return;

    gl.useProgram(prog);
    gl.bindVertexArray(quadVAO);

    // Set common uniforms
    const tsLoc = gl.getUniformLocation(prog, 'u_texelSize');
    gl.uniform2f(tsLoc, 1.0 / gridSize, 1.0 / gridSize);

    // Set model-specific uniforms
    if (currentModel === 'gray-scott') {
      gl.uniform1f(gl.getUniformLocation(prog, 'u_f'), params.f);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_k'), params.k);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_Du'), params.Du);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_Dv'), params.Dv);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_dt'), params.dt);
    } else if (currentModel === 'fitzhugh-nagumo') {
      gl.uniform1f(gl.getUniformLocation(prog, 'u_epsilon'), params.epsilon);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_a0'), params.a0);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_a1'), params.a1);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_Du'), params.Du);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_Dv'), params.Dv);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_dt'), params.dt);
    } else if (currentModel === 'schnakenberg') {
      gl.uniform1f(gl.getUniformLocation(prog, 'u_a'), params.a);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_b'), params.b);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_gamma'), params.gamma);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_Du'), params.Du);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_Dv'), params.Dv);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_dt'), params.dt);
    }

    // Brush uniforms
    gl.uniform1i(gl.getUniformLocation(prog, 'u_brushActive'), brushActive ? 1 : 0);
    if (brushActive) {
      gl.uniform2f(gl.getUniformLocation(prog, 'u_brushPos'), brushPos.x, brushPos.y);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_brushRadius'), brushRadius);
      gl.uniform1i(gl.getUniformLocation(prog, 'u_brushErase'), brushErase ? 1 : 0);
    }

    // Ping-pong
    const readIdx = currentFBO;
    const writeIdx = 1 - currentFBO;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, simTextures[readIdx]);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_state'), 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, simFBOs[writeIdx]);
    gl.viewport(0, 0, gridSize, gridSize);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    currentFBO = writeIdx;
  }

  // ===== RENDER =====
  function render() {
    if (!renderProgram) return;

    gl.useProgram(renderProgram);
    gl.bindVertexArray(quadVAO);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, simTextures[currentFBO]);
    gl.uniform1i(gl.getUniformLocation(renderProgram, 'u_state'), 0);

    // Color map
    const cmap = COLOR_MAPS[currentColorMap] || COLOR_MAPS.ocean;
    for (let i = 0; i < cmap.length && i < 5; i++) {
      gl.uniform3f(
        gl.getUniformLocation(renderProgram, `u_colorMap[${i}]`),
        cmap[i][0] / 255, cmap[i][1] / 255, cmap[i][2] / 255
      );
    }
    gl.uniform1i(gl.getUniformLocation(renderProgram, 'u_colorMapSize'), cmap.length);

    // Adjust V range based on model
    let vMin = 0.0, vMax = 1.0;
    if (currentModel === 'fitzhugh-nagumo') {
      vMin = -0.5; vMax = 0.5;
    } else if (currentModel === 'schnakenberg') {
      vMin = 0.0; vMax = params.b / ((params.a + params.b) * (params.a + params.b)) * 2.0;
    }
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'u_vMin'), vMin);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'u_vMax'), vMax);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ===== METRICS =====
  function computeMetrics() {
    // Read back downsampled grid
    const dsSize = 64;

    // Blit current state to downsample FBO
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, simFBOs[currentFBO]);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, downsampleFBO);
    gl.blitFramebuffer(0, 0, gridSize, gridSize, 0, 0, dsSize, dsSize, gl.COLOR_BUFFER_BIT, gl.NEAREST);

    gl.bindFramebuffer(gl.FRAMEBUFFER, downsampleFBO);
    const pixels = new Float32Array(dsSize * dsSize * 4);
    gl.readPixels(0, 0, dsSize, dsSize, gl.RGBA, gl.FLOAT, pixels);

    const n = dsSize * dsSize;
    let coverageCount = 0;
    let totalDelta = 0;
    let edgeCount = 0;
    let comX = 0, comY = 0, comTotal = 0;
    const threshold = 0.25;

    // Adjust threshold for different models
    let thresh = threshold;
    if (currentModel === 'fitzhugh-nagumo') thresh = 0.0;
    if (currentModel === 'schnakenberg') {
      const eq_v = params.b / ((params.a + params.b) * (params.a + params.b));
      thresh = eq_v * 1.2;
    }

    const vValues = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      vValues[i] = pixels[i * 4 + 1]; // G channel = V
    }

    for (let y = 0; y < dsSize; y++) {
      for (let x = 0; x < dsSize; x++) {
        const i = y * dsSize + x;
        const v = vValues[i];
        if (v > thresh) coverageCount++;

        // Center of mass
        comX += x * Math.abs(v);
        comY += y * Math.abs(v);
        comTotal += Math.abs(v);

        // Edge density
        if (x > 0 && x < dsSize - 1 && y > 0 && y < dsSize - 1) {
          const above = vValues[(y - 1) * dsSize + x] > thresh;
          const below = vValues[(y + 1) * dsSize + x] > thresh;
          const left = vValues[y * dsSize + (x - 1)] > thresh;
          const right = vValues[y * dsSize + (x + 1)] > thresh;
          const self = v > thresh;
          if (self !== above || self !== below || self !== left || self !== right) {
            edgeCount++;
          }
        }

        // Delta
        if (prevSample) {
          totalDelta += Math.abs(v - prevSample[i]);
        }
      }
    }

    // Symmetry (left-right correlation)
    let symNum = 0, symDen1 = 0, symDen2 = 0;
    for (let y = 0; y < dsSize; y++) {
      for (let x = 0; x < dsSize / 2; x++) {
        const left = vValues[y * dsSize + x];
        const right = vValues[y * dsSize + (dsSize - 1 - x)];
        symNum += left * right;
        symDen1 += left * left;
        symDen2 += right * right;
      }
    }
    const symCorr = (symDen1 > 0 && symDen2 > 0) ? symNum / Math.sqrt(symDen1 * symDen2) : 0;

    // Simple cluster count (approximate via sampling)
    let clusters = 0;
    const visited = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (vValues[i] > thresh && !visited[i]) {
        clusters++;
        if (clusters >= 100) break;
        // Simple flood fill
        const stack = [i];
        while (stack.length > 0) {
          const ci = stack.pop();
          if (visited[ci]) continue;
          visited[ci] = 1;
          const cx = ci % dsSize;
          const cy = Math.floor(ci / dsSize);
          if (cx > 0 && vValues[ci - 1] > thresh && !visited[ci - 1]) stack.push(ci - 1);
          if (cx < dsSize - 1 && vValues[ci + 1] > thresh && !visited[ci + 1]) stack.push(ci + 1);
          if (cy > 0 && vValues[ci - dsSize] > thresh && !visited[ci - dsSize]) stack.push(ci - dsSize);
          if (cy < dsSize - 1 && vValues[ci + dsSize] > thresh && !visited[ci + dsSize]) stack.push(ci + dsSize);
        }
      }
    }

    // EMA smoothing
    const alpha = 0.15;
    const rawCoverage = coverageCount / n;
    const rawDelta = prevSample ? totalDelta / n : 0;
    const rawEdge = edgeCount / n;

    metrics.coverage = metrics.coverage * (1 - alpha) + rawCoverage * alpha;
    metrics.delta = metrics.delta * (1 - alpha) + rawDelta * alpha;
    metrics.cluster_count = Math.round(metrics.cluster_count * (1 - alpha) + clusters * alpha);
    metrics.symmetry = metrics.symmetry * (1 - alpha) + symCorr * alpha;
    metrics.edge_density = metrics.edge_density * (1 - alpha) + rawEdge * alpha;
    if (comTotal > 0) {
      metrics.center_of_mass.x = metrics.center_of_mass.x * (1 - alpha) + (comX / comTotal / dsSize) * alpha;
      metrics.center_of_mass.y = metrics.center_of_mass.y * (1 - alpha) + (comY / comTotal / dsSize) * alpha;
    }

    prevSample = vValues.slice();
  }

  // ===== PUBLIC API =====
  return {
    MODELS,
    COLOR_MAPS,

    init,
    initGrid,
    resizeCanvas,

    get gl() { return gl; },
    get canvas() { return canvas; },
    get gridSize() { return gridSize; },
    get running() { return running; },
    get stepsPerFrame() { return stepsPerFrame; },
    get currentModel() { return currentModel; },
    get currentColorMap() { return currentColorMap; },
    get currentPresetName() { return currentPresetName; },
    get params() { return params; },
    get metrics() { return metrics; },
    get fps() { return fps; },

    set running(v) { running = v; },
    set stepsPerFrame(v) { stepsPerFrame = v; },

    setGridSize(size) {
      gridSize = size;
      initGrid();
      setupDownsampleFBO();
    },

    setModel(modelId) {
      currentModel = modelId;
      loadModelDefaults();
      initGrid();
      prevSample = null;
    },

    setParam(key, value) {
      params[key] = value;
    },

    setColorMap(name) {
      currentColorMap = name;
    },

    loadPreset(index) {
      const model = MODELS[currentModel];
      const preset = model.presets[index];
      if (!preset) return;
      currentPresetName = preset.name;

      // Apply preset params (only model-specific, keep Du/Dv/dt at their defaults unless specified)
      model.params.forEach(p => {
        if (preset[p.id] !== undefined) {
          params[p.id] = preset[p.id];
        }
      });
    },

    loadPresetAndClear(index) {
      this.loadPreset(index);
      initGrid();
      prevSample = null;
    },

    step(brushActive, brushPos, brushRadius, brushErase) {
      simStep(brushActive, brushPos, brushRadius, brushErase);
    },

    render() {
      render();
    },

    computeMetrics() {
      computeMetrics();
    },

    updateFPS() {
      fpsFrames++;
      const now = performance.now();
      fpsAccum += now - lastTime;
      lastTime = now;
      if (fpsAccum >= 500) {
        fps = Math.round(fpsFrames / (fpsAccum / 1000));
        fpsFrames = 0;
        fpsAccum = 0;
      }
    },

    getScreenshot() {
      render();
      return canvas.toDataURL('image/png');
    },

    getPermalink() {
      const p = new URLSearchParams();
      p.set('model', currentModel);
      p.set('preset', currentPresetName);
      p.set('colormap', currentColorMap);
      p.set('grid', gridSize);
      p.set('speed', stepsPerFrame);
      for (const key in params) {
        p.set(key, params[key]);
      }
      return window.location.origin + window.location.pathname + '?' + p.toString();
    },

    loadFromURL() {
      const p = new URLSearchParams(window.location.search);
      if (p.has('model')) {
        currentModel = p.get('model');
        loadModelDefaults();
      }
      if (p.has('grid')) gridSize = parseInt(p.get('grid'));
      if (p.has('speed')) stepsPerFrame = parseInt(p.get('speed'));
      if (p.has('colormap')) currentColorMap = p.get('colormap');

      // Load individual params
      const model = MODELS[currentModel];
      model.params.forEach(param => {
        if (p.has(param.id)) {
          params[param.id] = parseFloat(p.get(param.id));
        }
      });

      if (p.has('preset')) currentPresetName = p.get('preset');
    }
  };
})();
