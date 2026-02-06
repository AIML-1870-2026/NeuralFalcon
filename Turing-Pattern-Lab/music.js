// ===== Turing Pattern Lab - Generative Soundtrack Engine =====
// Single synth theme driven by simulation metrics.

const MusicEngine = (() => {
  let audioCtx = null;
  let masterGain = null;
  let convolver = null;
  let enabled = false;
  let volume = 0.5;
  let channels = {};
  let lastMetrics = null;
  let lastHookTime = 0;
  let lastStingerTime = 0;
  let lastClusterCount = 0;
  let activeOscillators = [];
  let phraseEndTime = 0;
  let bassEndTime = 0;
  let drumEndTime = 0;
  let hookEndTime = 0;

  // Note helper
  const NOTE_FREQ = {};
  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  for (let oct = 0; oct <= 8; oct++) {
    for (let i = 0; i < 12; i++) {
      NOTE_FREQ[NOTES[i] + oct] = 440 * Math.pow(2, (oct * 12 + i - 57) / 12);
    }
  }
  function n(name) { return NOTE_FREQ[name] || 440; }

  // ===== SONG DATA =====
  // Each note: [frequency, duration, volume]
  const SONG = {
    hook: [
      [n('B4'), 0.18, 0.9], [0, 0.07, 0], [n('B4'), 0.18, 0.9], [0, 0.07, 0],
      [n('B4'), 0.18, 0.9], [0, 0.07, 0], [n('B4'), 0.18, 0.9], [0, 0.22, 0],
      [n('B4'), 0.18, 0.9], [0, 0.07, 0], [n('B4'), 0.18, 0.9], [0, 0.07, 0],
      [n('B4'), 0.18, 0.9], [0, 0.07, 0], [n('B4'), 0.18, 0.9], [0, 0.4, 0],
    ],
    verse: [
      [n('E4'), 0.25, 0.7], [n('G4'), 0.25, 0.7], [n('A4'), 0.25, 0.7], [n('B4'), 0.5, 0.8],
      [0, 0.15, 0],
      [n('E4'), 0.2, 0.7], [n('G4'), 0.2, 0.7], [n('A4'), 0.2, 0.7], [n('B4'), 0.35, 0.8],
      [n('A4'), 0.2, 0.6], [n('G4'), 0.4, 0.7], [0, 0.2, 0],
      [n('E4'), 0.25, 0.7], [n('G4'), 0.25, 0.7], [n('A4'), 0.25, 0.7], [n('B4'), 0.5, 0.8],
      [0, 0.15, 0],
      [n('D5'), 0.3, 0.8], [n('B4'), 0.2, 0.7], [n('A4'), 0.2, 0.7], [n('G4'), 0.5, 0.7],
      [0, 0.3, 0],
    ],
    chorus: [
      [n('B4'), 0.3, 0.8], [n('D5'), 0.3, 0.8], [n('E5'), 0.6, 0.9], [0, 0.2, 0],
      [n('D5'), 0.25, 0.7], [n('B4'), 0.25, 0.7], [n('A4'), 0.5, 0.8], [0, 0.2, 0],
      [n('G4'), 0.25, 0.7], [n('A4'), 0.25, 0.7], [n('B4'), 0.6, 0.9], [0, 0.3, 0],
      [n('E4'), 0.2, 0.6], [n('G4'), 0.3, 0.7], [n('B4'), 0.3, 0.8], [n('D5'), 0.3, 0.8],
      [n('E5'), 0.5, 0.9], [0, 0.2, 0],
      [n('D5'), 0.2, 0.7], [n('B4'), 0.4, 0.8], [0, 0.3, 0],
    ],
    bass: [
      [n('E2'), 0.4, 0.5], [n('E2'), 0.4, 0.5], [n('G2'), 0.4, 0.5], [n('A2'), 0.4, 0.5],
      [n('B2'), 0.4, 0.5], [n('B2'), 0.4, 0.5], [n('A2'), 0.4, 0.5], [n('G2'), 0.4, 0.5],
      [n('E2'), 0.4, 0.5], [n('G2'), 0.4, 0.5], [n('B2'), 0.4, 0.5], [n('E3'), 0.4, 0.5],
      [n('D3'), 0.4, 0.5], [n('B2'), 0.4, 0.5], [n('A2'), 0.4, 0.5], [n('G2'), 0.4, 0.5],
    ],
    drumPattern: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
    drumBPM: 160,
  };

  // ===== AUDIO SETUP =====
  function initAudioContext() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(audioCtx.destination);

    convolver = audioCtx.createConvolver();
    convolver.buffer = createImpulseResponse(0.8, 1.5);
    convolver.connect(masterGain);

    channels = {
      base: createChannel(),
      melody: createChannel(),
      hook: createChannel(),
      texture: createChannel(),
      drums: createChannel()
    };
  }

  function createChannel() {
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    const pan = audioCtx.createStereoPanner();
    pan.pan.value = 0;
    const dryGain = audioCtx.createGain();
    dryGain.gain.value = 0.75;
    const wetGain = audioCtx.createGain();
    wetGain.gain.value = 0.25;

    gain.connect(pan);
    pan.connect(dryGain);
    pan.connect(wetGain);
    dryGain.connect(masterGain);
    wetGain.connect(convolver);

    return { gain, pan, dryGain, wetGain };
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

  // ===== NOTE PLAYBACK =====
  function playNote(channel, freq, duration, vol, waveform, startTime) {
    if (!audioCtx || freq <= 0) return;
    const ch = channels[channel];
    if (!ch) return;
    const t = startTime || audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = waveform || 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    const vibrato = audioCtx.createOscillator();
    const vibratoGain = audioCtx.createGain();
    vibrato.frequency.value = 5;
    vibratoGain.gain.value = freq * 0.008;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    vibrato.start(t);
    vibrato.stop(t + duration + 0.1);

    const env = audioCtx.createGain();
    const attack = Math.min(0.03, duration * 0.1);
    const release = Math.min(0.08, duration * 0.2);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol, t + attack);
    env.gain.setValueAtTime(vol, t + duration - release);
    env.gain.linearRampToValueAtTime(0, t + duration);

    osc.connect(env);
    env.connect(ch.gain);
    osc.start(t);
    osc.stop(t + duration + 0.01);

    activeOscillators.push({ osc, vibrato, stopTime: t + duration + 0.1 });
  }

  function playDrumHit(startTime) {
    const ch = channels.drums;
    if (!ch) return;
    const t = startTime || audioCtx.currentTime;
    const bufSize = Math.floor(audioCtx.sampleRate * 0.08);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.15));
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 4000;
    filter.Q.value = 1;
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    source.connect(filter);
    filter.connect(env);
    env.connect(ch.gain);
    source.start(t);
  }

  function schedulePhrase(channel, notes, waveform, startTime, rate) {
    let t = startTime;
    const playRate = rate || 1.0;
    for (const note of notes) {
      const [freq, dur, vol] = note;
      const actualDur = dur / playRate;
      if (freq > 0) playNote(channel, freq * playRate, actualDur, vol, waveform, t);
      t += actualDur;
    }
    return t - startTime;
  }

  function scheduleDrums(startTime, bpm, pattern, rate) {
    const beatDur = 60 / (bpm * (rate || 1.0)) / 2;
    let t = startTime;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i]) playDrumHit(t);
      t += beatDur;
    }
    return t - startTime;
  }

  // ===== METRIC-DRIVEN UPDATE =====
  function update(metrics) {
    if (!enabled || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const { coverage, delta, cluster_count, symmetry, edge_density, center_of_mass } = metrics;

    if (coverage < 0.02) {
      for (const key in channels) channels[key].gain.gain.linearRampToValueAtTime(0, now + 2);
      phraseEndTime = 0; bassEndTime = 0; drumEndTime = 0;
      updateVisualizer([0, 0, 0, 0, 0, 0]);
      return;
    }

    const rate = 0.8 + Math.min(delta * 4, 0.4);
    const baseVol = Math.min(1.0, coverage * 2) * 0.35;
    const melodyVol = Math.min(1.0, coverage * 1.5) * 0.5;
    const drumVol = (coverage > 0.1 && delta > 0.02) ? 0.3 : 0;

    channels.base.gain.gain.linearRampToValueAtTime(baseVol, now + 0.2);
    channels.melody.gain.gain.linearRampToValueAtTime(melodyVol, now + 0.2);
    channels.drums.gain.gain.linearRampToValueAtTime(drumVol, now + 0.2);
    channels.texture.gain.gain.linearRampToValueAtTime(edge_density * 0.15, now + 0.2);

    // Bass loop
    if (now >= bassEndTime - 0.1) {
      const dur = schedulePhrase('base', SONG.bass, 'sine', Math.max(now, bassEndTime), rate);
      bassEndTime = Math.max(now, bassEndTime) + dur;
    }

    // Drums
    if (drumVol > 0 && now >= drumEndTime - 0.1) {
      const dur = scheduleDrums(Math.max(now, drumEndTime), SONG.drumBPM, SONG.drumPattern, rate);
      drumEndTime = Math.max(now, drumEndTime) + dur;
    }

    // Melody — verse vs chorus
    if (now >= phraseEndTime - 0.1) {
      const phrase = cluster_count > 30 ? SONG.chorus : SONG.verse;
      const dur = schedulePhrase('melody', phrase, 'square', Math.max(now, phraseEndTime), rate);
      phraseEndTime = Math.max(now, phraseEndTime) + dur;
    }

    // Hook on rapid change
    if (delta > 0.12 && now - lastHookTime > 5 && now >= hookEndTime) {
      channels.hook.gain.gain.linearRampToValueAtTime(0.6, now + 0.05);
      const dur = schedulePhrase('hook', SONG.hook, 'square', now, rate);
      hookEndTime = now + dur;
      lastHookTime = now;
      setTimeout(() => {
        if (channels.hook && audioCtx)
          channels.hook.gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 1);
      }, dur * 1000 + 500);
    }

    // Texture
    if (edge_density > 0.15 && Math.random() < 0.03) {
      const bassNote = SONG.bass[Math.floor(Math.random() * SONG.bass.length)];
      if (bassNote[0] > 0) playNote('texture', bassNote[0] * 2, 1.0, 0.15, 'sine', now);
    }

    // Stinger
    const clusterDelta = Math.abs(cluster_count - lastClusterCount) / Math.max(1, lastClusterCount);
    if (clusterDelta > 0.25 && now - lastStingerTime > 3) {
      const baseFreq = SONG.hook[0][0] || 440;
      playNote('hook', baseFreq, 0.08, 0.5, 'square', now);
      playNote('hook', baseFreq * 1.5, 0.08, 0.4, 'square', now + 0.08);
      playNote('hook', baseFreq * 2, 0.12, 0.5, 'square', now + 0.16);
      lastStingerTime = now;
    }
    lastClusterCount = cluster_count;

    // Pan & reverb
    const panValue = Math.max(-0.8, Math.min(0.8, (center_of_mass.x - 0.5) * 1.6));
    const reverbWet = symmetry * 0.4;
    for (const key in channels) {
      channels[key].pan.pan.linearRampToValueAtTime(panValue, now + 0.2);
      channels[key].wetGain.gain.linearRampToValueAtTime(reverbWet, now + 0.3);
      channels[key].dryGain.gain.linearRampToValueAtTime(1 - reverbWet * 0.3, now + 0.3);
    }

    lastMetrics = { ...metrics };
    if (Math.random() < 0.1) {
      const cutoff = audioCtx.currentTime;
      activeOscillators = activeOscillators.filter(o => o.stopTime > cutoff);
    }

    updateVisualizer([
      baseVol / 0.35, melodyVol / 0.5,
      (now < hookEndTime) ? 0.8 : 0.1,
      edge_density, drumVol / 0.3, coverage
    ]);
  }

  function updateVisualizer(levels) {
    const bars = document.querySelectorAll('.viz-bar');
    bars.forEach((bar, i) => {
      const level = Math.min(1, levels[i] || 0);
      bar.style.height = Math.max(3, level * 22) + 'px';
      bar.classList.toggle('active', level > 0.1);
    });
  }

  function toggle() { enabled ? disable() : enable(); }

  function enable() {
    initAudioContext();
    enabled = true;
    phraseEndTime = 0; bassEndTime = 0; drumEndTime = 0; hookEndTime = 0;
    document.getElementById('audio-status').textContent = 'Soundtrack active';
    if (window.updateMusicButton) window.updateMusicButton();
  }

  function disable() {
    enabled = false;
    if (audioCtx) {
      for (const key in channels)
        channels[key].gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    }
    updateVisualizer([0, 0, 0, 0, 0, 0]);
    document.getElementById('audio-status').textContent = 'Soundtrack off';
    if (window.updateMusicButton) window.updateMusicButton();
  }

  function setVolume(v) {
    volume = v / 100;
    if (masterGain) masterGain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.1);
  }

  // ===== UI BINDINGS =====
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('music-toggle').addEventListener('click', toggle);
    document.getElementById('volume-slider').addEventListener('input', (e) => {
      setVolume(parseInt(e.target.value));
      document.getElementById('volume-val').textContent = e.target.value;
    });
  });

  return {
    get enabled() { return enabled; },
    toggle, enable, disable, update, setVolume
  };
})();
