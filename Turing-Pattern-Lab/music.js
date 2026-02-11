// ===== Turing Pattern Lab - Simulation Soundtrack Engine =====
// Drives music playback from simulation metrics.
// Requires audio clips in audio/ directory with manifest.json.
// Falls back to procedural synthesis if clips aren't available.

const MusicEngine = (() => {
  let audioCtx = null;
  let masterGain = null;
  let convolver = null;
  let enabled = false;
  let volume = 0.5;
  let currentTheme = 'science';
  let clips = {};
  let clipBuffers = {};
  let channels = {};
  let lastMetrics = null;
  let lastHookTime = 0;
  let lastStingerTime = 0;
  let lastClusterCount = 0;
  let clipIndices = { verse: 0, chorus: 0, instrumental: 0, percussion: 0 };
  let useSynth = false; // Fallback to synthesis if no audio files

  // Synthesizer state for fallback mode
  let synthOscillators = {};
  let synthInterval = null;

  const THEMES = {
    science: { name: 'Bill Nye the Science Guy', baseFreq: 220, scale: [0, 2, 4, 5, 7, 9, 11] },
    gummy: { name: "I'm a Gummy Bear", baseFreq: 262, scale: [0, 2, 4, 5, 7, 9, 11] },
    friday: { name: 'Friday', baseFreq: 196, scale: [0, 2, 3, 5, 7, 8, 10] },
    caillou: { name: 'Caillou', baseFreq: 294, scale: [0, 2, 4, 7, 9] }
  };

  function initAudioContext() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Master gain
    masterGain = audioCtx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(audioCtx.destination);

    // Reverb convolver
    convolver = audioCtx.createConvolver();
    convolver.buffer = createImpulseResponse(1.0, 2.0);
    convolver.connect(masterGain);

    // Create channel gains
    channels = {
      base: createChannel(),
      melody: createChannel(),
      hook: createChannel(),
      texture: createChannel()
    };

    // Try loading audio clips, fall back to synth
    loadThemeClips(currentTheme).catch(() => {
      console.log('Audio clips not found, using procedural synthesis');
      useSynth = true;
    });
  }

  function createChannel() {
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    const pan = audioCtx.createStereoPanner();
    pan.pan.value = 0;

    // Dry path -> master
    const dryGain = audioCtx.createGain();
    dryGain.gain.value = 0.7;

    // Wet path -> convolver -> master
    const wetGain = audioCtx.createGain();
    wetGain.gain.value = 0.3;

    gain.connect(pan);
    pan.connect(dryGain);
    pan.connect(wetGain);
    dryGain.connect(masterGain);
    wetGain.connect(convolver);

    return { gain, pan, dryGain, wetGain, activeSource: null };
  }

  function createImpulseResponse(duration, decay) {
    const length = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * decay / 6));
      }
    }
    return buffer;
  }

  async function loadThemeClips(theme) {
    try {
      const resp = await fetch(`audio/manifest.json`);
      if (!resp.ok) throw new Error('No manifest');
      const manifest = await resp.json();
      const themeData = manifest.themes[theme];
      if (!themeData) throw new Error('Theme not found');

      clips[theme] = {};
      clipBuffers[theme] = {};

      for (const clip of themeData.clips) {
        const cat = clip.category;
        if (!clips[theme][cat]) {
          clips[theme][cat] = [];
          clipBuffers[theme][cat] = [];
        }
        clips[theme][cat].push(clip);

        const audioResp = await fetch(`audio/${theme}/${clip.file}`);
        const arrayBuf = await audioResp.arrayBuffer();
        const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
        clipBuffers[theme][cat].push(audioBuf);
      }

      useSynth = false;
    } catch (e) {
      useSynth = true;
      throw e;
    }
  }

  function playClip(channel, category, rate) {
    if (!audioCtx || !enabled) return;

    if (useSynth) {
      playSynthNote(channel, category, rate);
      return;
    }

    const theme = currentTheme;
    if (!clipBuffers[theme] || !clipBuffers[theme][category]) return;
    const bufs = clipBuffers[theme][category];
    if (bufs.length === 0) return;

    const idx = clipIndices[category] !== undefined
      ? clipIndices[category] % bufs.length
      : Math.floor(Math.random() * bufs.length);

    const source = audioCtx.createBufferSource();
    source.buffer = bufs[idx];
    source.playbackRate.value = rate || 1.0;
    source.connect(channels[channel].gain);
    source.start();

    channels[channel].activeSource = source;
  }

  // ===== PROCEDURAL SYNTHESIS FALLBACK =====
  function playSynthNote(channel, category, rate) {
    if (!audioCtx || !enabled) return;

    const theme = THEMES[currentTheme];
    const ch = channels[channel];
    if (!ch) return;

    const scale = theme.scale;
    const baseFreq = theme.baseFreq;

    let freq, duration, type;

    switch (category) {
      case 'vocal_hook':
        // Bright, attention-grabbing
        freq = baseFreq * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12) * 2;
        duration = 0.3;
        type = 'square';
        break;
      case 'verse':
      case 'chorus':
        // Melodic
        freq = baseFreq * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12);
        duration = 0.5;
        type = 'triangle';
        break;
      case 'instrumental':
        freq = baseFreq * Math.pow(2, scale[Math.floor(Math.random() * scale.length)] / 12) * 0.5;
        duration = 0.8;
        type = 'sawtooth';
        break;
      case 'percussion':
        // Noise burst
        playNoiseBurst(ch, 0.1);
        return;
      case 'stinger':
        freq = baseFreq * 4;
        duration = 0.08;
        type = 'square';
        break;
      default:
        freq = baseFreq;
        duration = 0.3;
        type = 'sine';
    }

    freq *= (rate || 1.0);

    const osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0.3, audioCtx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(env);
    env.connect(ch.gain);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function playNoiseBurst(ch, duration) {
    const bufSize = audioCtx.sampleRate * duration;
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buf;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    source.connect(filter);
    filter.connect(ch.gain);
    source.start();
  }

  // ===== METRIC-DRIVEN UPDATE =====
  function update(metrics) {
    if (!enabled || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const { coverage, delta, cluster_count, symmetry, edge_density, center_of_mass } = metrics;

    // Silence when empty
    if (coverage < 0.02) {
      for (const key in channels) {
        channels[key].gain.gain.linearRampToValueAtTime(0, now + 2);
      }
      updateVisualizer([0, 0, 0, 0]);
      return;
    }

    // Playback rate from delta
    const rate = 0.7 + delta * 6.0 * 0.6; // Map to 0.7-1.3 range

    // === BASE LAYER (instrumental/percussion) ===
    const baseVol = Math.min(1.0, coverage * 2);
    channels.base.gain.gain.linearRampToValueAtTime(baseVol * 0.5, now + 0.1);

    // Percussion activation
    if (coverage > 0.1 && delta > 0.03) {
      if (!channels.base.activeSource || channels.base.percCooldown < now) {
        playClip('base', 'percussion', rate);
        channels.base.percCooldown = now + 1.0;
      }
    }

    // === MELODY LAYER (verse/chorus) ===
    const melodyVol = Math.min(1.0, coverage * 1.5);
    channels.melody.gain.gain.linearRampToValueAtTime(melodyVol * 0.4, now + 0.1);

    const category = cluster_count > 30 ? 'chorus' : 'verse';

    // Clip advance when delta settles
    if (delta < 0.05 && lastMetrics && lastMetrics.delta >= 0.05) {
      clipIndices[category] = (clipIndices[category] || 0) + 1;
      playClip('melody', category, rate);
    }

    // === HOOK LAYER ===
    if (delta > 0.15 && now - lastHookTime > 4) {
      channels.hook.gain.gain.linearRampToValueAtTime(0.6, now + 0.05);
      playClip('hook', 'vocal_hook', rate);
      lastHookTime = now;
      setTimeout(() => {
        if (channels.hook) {
          channels.hook.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        }
      }, 2000);
    }

    // Stinger on cluster count change
    const clusterDelta = Math.abs(cluster_count - lastClusterCount) / Math.max(1, lastClusterCount);
    if (clusterDelta > 0.2 && now - lastStingerTime > 2) {
      playClip('hook', 'stinger', 1.0);
      lastStingerTime = now;
    }
    lastClusterCount = cluster_count;

    // === TEXTURE LAYER ===
    const textureVol = edge_density * 0.3;
    channels.texture.gain.gain.linearRampToValueAtTime(textureVol, now + 0.2);

    if (edge_density > 0.1 && Math.random() < 0.05) {
      playClip('texture', 'instrumental', rate * 0.5);
    }

    // === STEREO PAN ===
    const panValue = (center_of_mass.x - 0.5) * 1.5;
    for (const key in channels) {
      channels[key].pan.pan.linearRampToValueAtTime(
        Math.max(-1, Math.min(1, panValue)), now + 0.1
      );
    }

    // === REVERB MIX ===
    const reverbWet = symmetry * 0.5;
    for (const key in channels) {
      channels[key].wetGain.gain.linearRampToValueAtTime(reverbWet, now + 0.2);
      channels[key].dryGain.gain.linearRampToValueAtTime(1 - reverbWet * 0.5, now + 0.2);
    }

    // Periodic base note
    if (Math.random() < 0.08) {
      playClip('base', 'instrumental', rate);
    }

    // Periodic melody
    if (Math.random() < 0.06) {
      playClip('melody', category, rate);
    }

    lastMetrics = { ...metrics };

    // Update visualizer
    updateVisualizer([
      baseVol,
      melodyVol,
      delta > 0.15 ? 0.8 : 0,
      textureVol,
      coverage,
      edge_density
    ]);
  }

  function updateVisualizer(levels) {
    const bars = document.querySelectorAll('.viz-bar');
    bars.forEach((bar, i) => {
      const level = levels[i] || 0;
      const height = Math.max(3, level * 20);
      bar.style.height = height + 'px';
      bar.classList.toggle('active', level > 0.05);
    });
  }

  function toggle() {
    if (enabled) {
      disable();
    } else {
      enable();
    }
  }

  function enable() {
    initAudioContext();
    enabled = true;
    document.getElementById('audio-status').textContent = useSynth
      ? 'Synthesis mode active (no audio clips found)'
      : 'Audio engine active';
    if (window.updateMusicButton) window.updateMusicButton();
  }

  function disable() {
    enabled = false;
    if (audioCtx) {
      for (const key in channels) {
        channels[key].gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
      }
    }
    updateVisualizer([0, 0, 0, 0, 0, 0]);
    document.getElementById('audio-status').textContent = 'Audio engine stopped';
    if (window.updateMusicButton) window.updateMusicButton();
  }

  function setVolume(v) {
    volume = v / 100;
    if (masterGain) {
      masterGain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.1);
    }
  }

  function setTheme(theme) {
    currentTheme = theme;
    clipIndices = { verse: 0, chorus: 0, instrumental: 0, percussion: 0 };
    if (audioCtx && enabled) {
      // Fade out current, load new
      for (const key in channels) {
        channels[key].gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
      }
      if (!useSynth) {
        loadThemeClips(theme).catch(() => {
          useSynth = true;
        });
      }
    }
  }

  // ===== UI BINDINGS =====
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('music-toggle').addEventListener('click', toggle);

    document.getElementById('volume-slider').addEventListener('input', (e) => {
      setVolume(parseInt(e.target.value));
      document.getElementById('volume-val').textContent = e.target.value;
    });

    document.getElementById('theme-select').addEventListener('change', (e) => {
      setTheme(e.target.value);
    });
  });

  return {
    get enabled() { return enabled; },
    toggle,
    enable,
    disable,
    update,
    setVolume,
    setTheme
  };
})();
