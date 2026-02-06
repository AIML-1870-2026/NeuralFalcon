// ===== Turing Pattern Lab - Simulation Soundtrack Engine =====
// Plays recognizable melodies from real songs, driven by simulation metrics.
// Each song's actual melody is programmed note-by-note.

const MusicEngine = (() => {
  let audioCtx = null;
  let masterGain = null;
  let convolver = null;
  let enabled = false;
  let volume = 0.5;
  let currentTheme = 'science';
  let channels = {};
  let lastMetrics = null;
  let lastHookTime = 0;
  let lastStingerTime = 0;
  let lastClusterCount = 0;
  let melodyPos = { verse: 0, chorus: 0, hook: 0, bass: 0 };
  let scheduledUntil = 0;
  let melodyScheduler = null;
  let activeOscillators = [];

  // Note helper: convert note name to frequency
  const NOTE_FREQ = {};
  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  for (let oct = 0; oct <= 8; oct++) {
    for (let i = 0; i < 12; i++) {
      const noteNum = oct * 12 + i;
      NOTE_FREQ[NOTES[i] + oct] = 440 * Math.pow(2, (noteNum - 57) / 12);
    }
  }

  function n(name) { return NOTE_FREQ[name] || 440; }

  // ===================================================================
  // SONG DATA — actual melodies transcribed note-by-note
  // Each note: [frequency, duration in seconds, volume 0-1]
  // R = rest
  // ===================================================================

  const SONGS = {
    science: {
      name: 'Bill Nye the Science Guy',
      bpm: 160,
      // "BILL BILL BILL BILL" chant — B4 repeated rhythmically
      hook: [
        [n('B4'), 0.18, 0.9], [0, 0.07, 0], [n('B4'), 0.18, 0.9], [0, 0.07, 0],
        [n('B4'), 0.18, 0.9], [0, 0.07, 0], [n('B4'), 0.18, 0.9], [0, 0.22, 0],
        [n('B4'), 0.18, 0.9], [0, 0.07, 0], [n('B4'), 0.18, 0.9], [0, 0.07, 0],
        [n('B4'), 0.18, 0.9], [0, 0.07, 0], [n('B4'), 0.18, 0.9], [0, 0.4, 0],
      ],
      // "Bill Nye the Science Guy" main theme melody
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
      // "Science rules!" chorus
      chorus: [
        [n('B4'), 0.3, 0.8], [n('D5'), 0.3, 0.8], [n('E5'), 0.6, 0.9], [0, 0.2, 0],
        [n('D5'), 0.25, 0.7], [n('B4'), 0.25, 0.7], [n('A4'), 0.5, 0.8], [0, 0.2, 0],
        [n('G4'), 0.25, 0.7], [n('A4'), 0.25, 0.7], [n('B4'), 0.6, 0.9], [0, 0.3, 0],
        [n('E4'), 0.2, 0.6], [n('G4'), 0.3, 0.7], [n('B4'), 0.3, 0.8], [n('D5'), 0.3, 0.8],
        [n('E5'), 0.5, 0.9], [0, 0.2, 0],
        [n('D5'), 0.2, 0.7], [n('B4'), 0.4, 0.8], [0, 0.3, 0],
      ],
      // Bass line
      bass: [
        [n('E2'), 0.4, 0.5], [n('E2'), 0.4, 0.5], [n('G2'), 0.4, 0.5], [n('A2'), 0.4, 0.5],
        [n('B2'), 0.4, 0.5], [n('B2'), 0.4, 0.5], [n('A2'), 0.4, 0.5], [n('G2'), 0.4, 0.5],
        [n('E2'), 0.4, 0.5], [n('G2'), 0.4, 0.5], [n('B2'), 0.4, 0.5], [n('E3'), 0.4, 0.5],
        [n('D3'), 0.4, 0.5], [n('B2'), 0.4, 0.5], [n('A2'), 0.4, 0.5], [n('G2'), 0.4, 0.5],
      ],
      // Drum pattern
      drumBPM: 160,
      drumPattern: [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
      waveform: 'square',
      melodyWave: 'square',
    },

    gummy: {
      name: "I'm a Gummy Bear",
      bpm: 140,
      // "Oh I'm a gummy bear, yes I'm a gummy bear"
      hook: [
        [n('D5'), 0.2, 0.8], [0, 0.05, 0],
        [n('D5'), 0.15, 0.7], [n('E5'), 0.15, 0.7], [n('F#5'), 0.3, 0.8], [n('D5'), 0.3, 0.8],
        [0, 0.1, 0],
        [n('B4'), 0.15, 0.7], [n('D5'), 0.15, 0.7], [n('A4'), 0.4, 0.8],
        [0, 0.15, 0],
        [n('D5'), 0.15, 0.7], [n('E5'), 0.15, 0.7], [n('F#5'), 0.3, 0.8], [n('D5'), 0.3, 0.8],
        [0, 0.1, 0],
        [n('B4'), 0.15, 0.7], [n('A4'), 0.15, 0.7], [n('G4'), 0.5, 0.8],
        [0, 0.2, 0],
      ],
      // "Oh yeah, I'm a yummy tummy funny lucky gummy bear"
      verse: [
        [n('G4'), 0.2, 0.7], [n('B4'), 0.2, 0.7], [n('D5'), 0.2, 0.7], [n('B4'), 0.2, 0.7],
        [n('G4'), 0.2, 0.7], [n('B4'), 0.2, 0.7], [n('D5'), 0.4, 0.8], [0, 0.15, 0],
        [n('E5'), 0.2, 0.7], [n('D5'), 0.2, 0.7], [n('B4'), 0.2, 0.7], [n('A4'), 0.2, 0.7],
        [n('G4'), 0.4, 0.8], [0, 0.15, 0],
        [n('A4'), 0.2, 0.7], [n('B4'), 0.2, 0.7], [n('A4'), 0.2, 0.7], [n('G4'), 0.2, 0.7],
        [n('F#4'), 0.2, 0.7], [n('G4'), 0.2, 0.7], [n('A4'), 0.4, 0.8],
        [0, 0.3, 0],
      ],
      // Chorus - bouncy repeat
      chorus: [
        [n('D5'), 0.15, 0.8], [n('D5'), 0.15, 0.8], [n('E5'), 0.15, 0.8], [n('F#5'), 0.3, 0.9],
        [0, 0.1, 0],
        [n('D5'), 0.15, 0.7], [n('B4'), 0.15, 0.7], [n('A4'), 0.3, 0.8],
        [0, 0.1, 0],
        [n('G4'), 0.15, 0.7], [n('A4'), 0.15, 0.7], [n('B4'), 0.3, 0.8],
        [n('A4'), 0.15, 0.7], [n('G4'), 0.15, 0.7], [n('F#4'), 0.3, 0.8],
        [n('G4'), 0.5, 0.9],
        [0, 0.2, 0],
        [n('D5'), 0.15, 0.8], [n('E5'), 0.15, 0.8], [n('F#5'), 0.3, 0.9],
        [n('G5'), 0.15, 0.8], [n('F#5'), 0.15, 0.8], [n('E5'), 0.15, 0.7],
        [n('D5'), 0.5, 0.9], [0, 0.3, 0],
      ],
      bass: [
        [n('G2'), 0.3, 0.5], [n('G2'), 0.15, 0.4], [n('B2'), 0.3, 0.5], [n('D3'), 0.15, 0.4],
        [n('G2'), 0.3, 0.5], [n('D3'), 0.15, 0.4], [n('B2'), 0.3, 0.5], [n('G2'), 0.15, 0.4],
        [n('A2'), 0.3, 0.5], [n('A2'), 0.15, 0.4], [n('D3'), 0.3, 0.5], [n('A2'), 0.15, 0.4],
        [n('D2'), 0.3, 0.5], [n('A2'), 0.15, 0.4], [n('D3'), 0.3, 0.5], [n('D2'), 0.15, 0.4],
      ],
      drumPattern: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      drumBPM: 140,
      waveform: 'triangle',
      melodyWave: 'square',
    },

    friday: {
      name: 'Friday (Rebecca Black)',
      bpm: 116,
      // "Friday, Friday, gotta get down on Friday"
      hook: [
        [n('C5'), 0.35, 0.9], [n('C5'), 0.2, 0.7], [n('Bb4'), 0.2, 0.7], [n('Ab4'), 0.35, 0.8],
        [0, 0.15, 0],
        [n('C5'), 0.35, 0.9], [n('C5'), 0.2, 0.7], [n('Bb4'), 0.2, 0.7], [n('Ab4'), 0.35, 0.8],
        [0, 0.15, 0],
        [n('Ab4'), 0.2, 0.7], [n('Bb4'), 0.2, 0.7], [n('C5'), 0.2, 0.7],
        [n('Bb4'), 0.2, 0.7], [n('Ab4'), 0.2, 0.7], [n('G4'), 0.2, 0.7],
        [n('Ab4'), 0.2, 0.7], [n('Bb4'), 0.4, 0.8], [n('C5'), 0.5, 0.9],
        [0, 0.3, 0],
      ],
      // "Seven AM waking up in the morning"
      verse: [
        [n('Ab4'), 0.25, 0.7], [n('Ab4'), 0.2, 0.6], [n('Bb4'), 0.25, 0.7], [n('C5'), 0.25, 0.7],
        [n('C5'), 0.25, 0.7], [n('Bb4'), 0.2, 0.6], [n('Ab4'), 0.25, 0.7], [n('Bb4'), 0.4, 0.8],
        [0, 0.2, 0],
        [n('Ab4'), 0.2, 0.6], [n('Ab4'), 0.2, 0.6], [n('Bb4'), 0.25, 0.7], [n('C5'), 0.25, 0.7],
        [n('C5'), 0.2, 0.7], [n('Eb5'), 0.25, 0.8], [n('C5'), 0.2, 0.7], [n('Bb4'), 0.4, 0.8],
        [0, 0.2, 0],
        [n('Ab4'), 0.2, 0.7], [n('Bb4'), 0.2, 0.7], [n('C5'), 0.3, 0.8], [n('Bb4'), 0.3, 0.7],
        [n('Ab4'), 0.5, 0.8], [0, 0.3, 0],
      ],
      // "Partyin partyin yeah, fun fun fun"
      chorus: [
        [n('C5'), 0.2, 0.8], [n('C5'), 0.15, 0.7], [n('Bb4'), 0.15, 0.7],
        [n('Ab4'), 0.2, 0.7], [n('Ab4'), 0.15, 0.7], [n('Bb4'), 0.15, 0.7],
        [n('C5'), 0.4, 0.9], [0, 0.15, 0],
        [n('C5'), 0.2, 0.8], [n('C5'), 0.15, 0.7], [n('Bb4'), 0.15, 0.7],
        [n('Ab4'), 0.2, 0.7], [n('Bb4'), 0.3, 0.8], [n('C5'), 0.4, 0.9],
        [0, 0.15, 0],
        [n('Eb5'), 0.25, 0.8], [n('Eb5'), 0.25, 0.8], [n('Eb5'), 0.5, 0.9],
        [0, 0.15, 0],
        [n('C5'), 0.2, 0.7], [n('C5'), 0.2, 0.7], [n('C5'), 0.4, 0.8],
        [0, 0.3, 0],
      ],
      bass: [
        [n('Ab2'), 0.4, 0.5], [n('Ab2'), 0.2, 0.4], [n('Ab2'), 0.4, 0.5], [n('Eb3'), 0.2, 0.4],
        [n('Bb2'), 0.4, 0.5], [n('Bb2'), 0.2, 0.4], [n('Bb2'), 0.4, 0.5], [n('F3'), 0.2, 0.4],
        [n('C3'), 0.4, 0.5], [n('C3'), 0.2, 0.4], [n('C3'), 0.4, 0.5], [n('G3'), 0.2, 0.4],
        [n('Ab2'), 0.4, 0.5], [n('Ab2'), 0.2, 0.4], [n('Bb2'), 0.4, 0.5], [n('Bb2'), 0.2, 0.4],
      ],
      drumPattern: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      drumBPM: 116,
      waveform: 'sine',
      melodyWave: 'triangle',
    },

    caillou: {
      name: 'Caillou',
      bpm: 120,
      // "I'm just a kid who's four, each day I grow some more"
      hook: [
        [n('C5'), 0.3, 0.8], [n('D5'), 0.3, 0.8], [n('E5'), 0.3, 0.8], [n('C5'), 0.3, 0.8],
        [0, 0.1, 0],
        [n('E5'), 0.3, 0.8], [n('F5'), 0.3, 0.8], [n('G5'), 0.6, 0.9],
        [0, 0.2, 0],
        [n('G5'), 0.2, 0.7], [n('A5'), 0.2, 0.7], [n('G5'), 0.2, 0.7], [n('F5'), 0.2, 0.7],
        [n('E5'), 0.3, 0.8], [n('C5'), 0.3, 0.8], [n('D5'), 0.6, 0.8],
        [0, 0.3, 0],
      ],
      // "I like exploring, I'm Caillou" verse melody
      verse: [
        [n('G4'), 0.3, 0.7], [n('A4'), 0.3, 0.7], [n('B4'), 0.3, 0.7], [n('C5'), 0.5, 0.8],
        [0, 0.15, 0],
        [n('D5'), 0.3, 0.7], [n('C5'), 0.3, 0.7], [n('B4'), 0.3, 0.7], [n('A4'), 0.5, 0.8],
        [0, 0.15, 0],
        [n('G4'), 0.2, 0.7], [n('A4'), 0.2, 0.7], [n('B4'), 0.2, 0.7],
        [n('C5'), 0.3, 0.8], [n('D5'), 0.3, 0.8], [n('E5'), 0.5, 0.8],
        [0, 0.1, 0],
        [n('D5'), 0.25, 0.7], [n('C5'), 0.25, 0.7], [n('B4'), 0.25, 0.7], [n('C5'), 0.5, 0.8],
        [0, 0.3, 0],
      ],
      // "That's me! Caillou!" chorus
      chorus: [
        [n('E5'), 0.3, 0.9], [n('D5'), 0.3, 0.8], [n('C5'), 0.6, 0.9], [0, 0.2, 0],
        [n('C5'), 0.2, 0.7], [n('D5'), 0.2, 0.7], [n('E5'), 0.2, 0.7],
        [n('F5'), 0.2, 0.7], [n('E5'), 0.2, 0.7], [n('D5'), 0.5, 0.8], [0, 0.2, 0],
        [n('C5'), 0.25, 0.8], [n('E5'), 0.25, 0.8], [n('G5'), 0.6, 0.9], [0, 0.15, 0],
        [n('G5'), 0.2, 0.7], [n('F5'), 0.2, 0.7], [n('E5'), 0.2, 0.7], [n('D5'), 0.2, 0.7],
        [n('C5'), 0.7, 0.9], [0, 0.3, 0],
      ],
      bass: [
        [n('C3'), 0.4, 0.5], [n('E3'), 0.2, 0.4], [n('G3'), 0.4, 0.5], [n('E3'), 0.2, 0.4],
        [n('F3'), 0.4, 0.5], [n('A3'), 0.2, 0.4], [n('C4'), 0.4, 0.5], [n('A3'), 0.2, 0.4],
        [n('G3'), 0.4, 0.5], [n('B3'), 0.2, 0.4], [n('D4'), 0.4, 0.5], [n('B3'), 0.2, 0.4],
        [n('C3'), 0.4, 0.5], [n('G3'), 0.2, 0.4], [n('E3'), 0.4, 0.5], [n('C3'), 0.2, 0.4],
      ],
      drumPattern: [1,0,1,0, 0,0,1,0, 1,0,1,0, 0,0,1,0],
      drumBPM: 120,
      waveform: 'sine',
      melodyWave: 'triangle',
    }
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
      base: createChannel(0.35),
      melody: createChannel(0.5),
      hook: createChannel(0.6),
      texture: createChannel(0.2),
      drums: createChannel(0.3)
    };
  }

  function createChannel(initialVol) {
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

    return { gain, pan, dryGain, wetGain, maxVol: initialVol, playing: false };
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
  // Plays a single note with envelope on a given channel
  function playNote(channel, freq, duration, vol, waveform, startTime) {
    if (!audioCtx || freq <= 0) return;
    const ch = channels[channel];
    if (!ch) return;

    const t = startTime || audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = waveform || 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    // Add slight vibrato for more natural sound
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

  // Play a drum hit (noise burst)
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

  // Schedule a sequence of notes on a channel, returns total duration
  function schedulePhrase(channel, notes, waveform, startTime, rate) {
    let t = startTime;
    const playRate = rate || 1.0;

    for (const note of notes) {
      const [freq, dur, vol] = note;
      const actualDur = dur / playRate;

      if (freq > 0) {
        playNote(channel, freq * playRate, actualDur, vol, waveform, t);
      }
      t += actualDur;
    }

    return t - startTime;
  }

  // Schedule drum pattern
  function scheduleDrums(startTime, bpm, pattern, rate) {
    const beatDur = 60 / (bpm * (rate || 1.0)) / 2; // sixteenth notes
    let t = startTime;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i]) {
        playDrumHit(t);
      }
      t += beatDur;
    }
    return t - startTime;
  }

  // Cleanup old oscillators
  function cleanupOscillators() {
    const now = audioCtx.currentTime;
    activeOscillators = activeOscillators.filter(o => o.stopTime > now);
  }

  // ===== METRIC-DRIVEN UPDATE =====
  let phraseEndTime = 0;
  let bassEndTime = 0;
  let drumEndTime = 0;
  let hookEndTime = 0;

  function update(metrics) {
    if (!enabled || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const { coverage, delta, cluster_count, symmetry, edge_density, center_of_mass } = metrics;

    const song = SONGS[currentTheme];
    if (!song) return;

    // Silence when grid is empty
    if (coverage < 0.02) {
      for (const key in channels) {
        channels[key].gain.gain.linearRampToValueAtTime(0, now + 2);
      }
      phraseEndTime = 0;
      bassEndTime = 0;
      drumEndTime = 0;
      updateVisualizer([0, 0, 0, 0, 0, 0]);
      return;
    }

    // Playback rate modulated by simulation activity
    const rate = 0.8 + Math.min(delta * 4, 0.4); // 0.8x to 1.2x

    // === CHANNEL VOLUMES based on coverage ===
    const baseVol = Math.min(1.0, coverage * 2) * 0.35;
    const melodyVol = Math.min(1.0, coverage * 1.5) * 0.5;
    const drumVol = (coverage > 0.1 && delta > 0.02) ? 0.3 : 0;

    channels.base.gain.gain.linearRampToValueAtTime(baseVol, now + 0.2);
    channels.melody.gain.gain.linearRampToValueAtTime(melodyVol, now + 0.2);
    channels.drums.gain.gain.linearRampToValueAtTime(drumVol, now + 0.2);
    channels.texture.gain.gain.linearRampToValueAtTime(edge_density * 0.15, now + 0.2);

    // === BASS LINE — continuous loop ===
    if (now >= bassEndTime - 0.1) {
      const dur = schedulePhrase('base', song.bass, song.waveform || 'sine',
        Math.max(now, bassEndTime), rate);
      bassEndTime = Math.max(now, bassEndTime) + dur;
    }

    // === DRUMS — continuous when active ===
    if (drumVol > 0 && now >= drumEndTime - 0.1) {
      const dur = scheduleDrums(Math.max(now, drumEndTime),
        song.drumBPM || song.bpm, song.drumPattern, rate);
      drumEndTime = Math.max(now, drumEndTime) + dur;
    }

    // === MELODY — verse vs chorus based on cluster count ===
    if (now >= phraseEndTime - 0.1) {
      let phrase;
      if (cluster_count > 30) {
        phrase = song.chorus;
        melodyPos.chorus++;
      } else {
        phrase = song.verse;
        melodyPos.verse++;
      }

      // Rotate through the phrase starting at different points for variety
      const dur = schedulePhrase('melody', phrase, song.melodyWave || 'triangle',
        Math.max(now, phraseEndTime), rate);
      phraseEndTime = Math.max(now, phraseEndTime) + dur;
    }

    // === HOOK — triggered by rapid pattern change ===
    if (delta > 0.12 && now - lastHookTime > 5 && now >= hookEndTime) {
      channels.hook.gain.gain.linearRampToValueAtTime(0.6, now + 0.05);
      const dur = schedulePhrase('hook', song.hook, song.melodyWave || 'square', now, rate);
      hookEndTime = now + dur;
      lastHookTime = now;

      // Fade hook back down after it plays
      setTimeout(() => {
        if (channels.hook && audioCtx) {
          channels.hook.gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 1);
        }
      }, dur * 1000 + 500);
    }

    // === TEXTURE — sparse notes from bass when edges are complex ===
    if (edge_density > 0.15 && Math.random() < 0.03) {
      const bassNote = song.bass[Math.floor(Math.random() * song.bass.length)];
      if (bassNote[0] > 0) {
        playNote('texture', bassNote[0] * 2, 1.0, 0.15, 'sine', now);
      }
    }

    // === STEREO PAN from center of mass ===
    const panValue = Math.max(-0.8, Math.min(0.8, (center_of_mass.x - 0.5) * 1.6));
    for (const key in channels) {
      channels[key].pan.pan.linearRampToValueAtTime(panValue, now + 0.2);
    }

    // === REVERB driven by symmetry ===
    const reverbWet = symmetry * 0.4;
    for (const key in channels) {
      channels[key].wetGain.gain.linearRampToValueAtTime(reverbWet, now + 0.3);
      channels[key].dryGain.gain.linearRampToValueAtTime(1 - reverbWet * 0.3, now + 0.3);
    }

    // Stinger on big cluster changes
    const clusterDelta = Math.abs(cluster_count - lastClusterCount) / Math.max(1, lastClusterCount);
    if (clusterDelta > 0.25 && now - lastStingerTime > 3) {
      // Quick arpeggio stinger
      const baseFreq = song.hook[0][0] || 440;
      playNote('hook', baseFreq, 0.08, 0.5, 'square', now);
      playNote('hook', baseFreq * 1.5, 0.08, 0.4, 'square', now + 0.08);
      playNote('hook', baseFreq * 2, 0.12, 0.5, 'square', now + 0.16);
      lastStingerTime = now;
    }
    lastClusterCount = cluster_count;

    lastMetrics = { ...metrics };

    // Periodically cleanup
    if (Math.random() < 0.1) cleanupOscillators();

    // Update visualizer bars
    updateVisualizer([
      baseVol / 0.35,
      melodyVol / 0.5,
      (now < hookEndTime) ? 0.8 : 0.1,
      edge_density,
      drumVol / 0.3,
      coverage
    ]);
  }

  function updateVisualizer(levels) {
    const bars = document.querySelectorAll('.viz-bar');
    bars.forEach((bar, i) => {
      const level = levels[i] || 0;
      const height = Math.max(3, level * 22);
      bar.style.height = height + 'px';
      bar.classList.toggle('active', level > 0.1);
    });
  }

  function toggle() {
    if (enabled) disable();
    else enable();
  }

  function enable() {
    initAudioContext();
    enabled = true;
    phraseEndTime = 0;
    bassEndTime = 0;
    drumEndTime = 0;
    hookEndTime = 0;
    document.getElementById('audio-status').textContent =
      `Playing: ${SONGS[currentTheme].name}`;
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
    melodyPos = { verse: 0, chorus: 0, hook: 0, bass: 0 };
    phraseEndTime = 0;
    bassEndTime = 0;
    drumEndTime = 0;
    hookEndTime = 0;
    if (audioCtx && enabled) {
      for (const key in channels) {
        channels[key].gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
      }
      document.getElementById('audio-status').textContent =
        `Playing: ${SONGS[theme].name}`;
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
