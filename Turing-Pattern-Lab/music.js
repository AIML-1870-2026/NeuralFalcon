// ===== Turing Pattern Lab - YouTube Soundtrack Engine =====
// Plays ACTUAL songs via YouTube IFrame API, seeking between
// sections (verse, chorus, hook) driven by simulation metrics.

const MusicEngine = (() => {
  let player = null;
  let enabled = false;
  let volume = 50;
  let currentTheme = 'science';
  let playerReady = false;
  let apiReady = false;
  let lastMetrics = null;
  let lastSectionChange = 0;
  let lastClusterCount = 0;
  let currentSection = 'verse';
  let sectionStartTime = 0;
  let sectionEndTime = 0;
  let checkInterval = null;

  // ===== SONG DATABASE =====
  // Each song: YouTube video ID + timestamps for sections
  const SONGS = {
    science: {
      name: 'Bill Nye the Science Guy',
      videoId: 'bebSxF0rr5I',
      sections: {
        hook:    { start: 0,  end: 5  },  // "BILL BILL BILL BILL"
        verse:   { start: 5,  end: 22 },  // Main theme verse
        chorus:  { start: 22, end: 38 },  // "Science rules!" section
        bridge:  { start: 38, end: 50 },  // Ending section
      }
    },
    gummy: {
      name: "I'm a Gummy Bear",
      videoId: 'astJ4yBn0vE',
      sections: {
        hook:    { start: 12, end: 25 },  // "Oh I'm a gummy bear"
        verse:   { start: 25, end: 48 },  // Verse
        chorus:  { start: 48, end: 72 },  // Full chorus
        bridge:  { start: 72, end: 90 },  // Bridge/instrumental
      }
    },
    friday: {
      name: 'Friday (Rebecca Black)',
      videoId: 'kfVsfOSbJY0',
      sections: {
        hook:    { start: 60, end: 82 },  // "Friday Friday" chorus
        verse:   { start: 7,  end: 35 },  // "7 AM waking up"
        chorus:  { start: 45, end: 75 },  // Pre-chorus + chorus
        bridge:  { start: 130, end: 160 }, // Rap bridge
      }
    },
    caillou: {
      name: 'Caillou',
      videoId: 'p2cQSPRTdhg',
      sections: {
        hook:    { start: 0,  end: 15 },  // "I'm just a kid who's four"
        verse:   { start: 15, end: 30 },  // "My world is turning"
        chorus:  { start: 30, end: 45 },  // "Growing up is not so tough"
        bridge:  { start: 0,  end: 20 },  // Loop back
      }
    }
  };

  // ===== YOUTUBE API SETUP =====
  // The YouTube IFrame API calls this global function when ready
  window.onYouTubeIframeAPIReady = function() {
    apiReady = true;
    console.log('YouTube IFrame API ready');
  };

  function createPlayer(videoId) {
    if (player) {
      player.destroy();
      player = null;
      playerReady = false;
    }

    player = new YT.Player('yt-player', {
      height: '150',
      width: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        playsinline: 1,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: onPlayerError,
      }
    });
  }

  function onPlayerReady() {
    playerReady = true;
    player.setVolume(volume);
    console.log('YouTube player ready');

    if (enabled) {
      startPlayback();
    }
  }

  function onPlayerStateChange(event) {
    // When video ends or is paused unexpectedly, loop current section
    if (event.data === YT.PlayerState.ENDED) {
      if (enabled) {
        seekToSection(currentSection);
      }
    }
  }

  function onPlayerError(event) {
    console.warn('YouTube player error:', event.data);
    document.getElementById('audio-status').textContent =
      'Video unavailable. Try a different theme.';
  }

  // ===== SECTION CONTROL =====
  function seekToSection(sectionName) {
    if (!player || !playerReady) return;

    const song = SONGS[currentTheme];
    if (!song) return;

    const section = song.sections[sectionName];
    if (!section) return;

    currentSection = sectionName;
    sectionStartTime = section.start;
    sectionEndTime = section.end;

    player.seekTo(section.start, true);

    if (player.getPlayerState() !== YT.PlayerState.PLAYING) {
      player.playVideo();
    }

    document.getElementById('audio-status').textContent =
      `${song.name} — ${sectionName}`;
  }

  function startPlayback() {
    if (!player || !playerReady) return;

    player.setVolume(volume);
    seekToSection('verse');

    // Start section monitoring
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(checkSectionBounds, 200);
  }

  function stopPlayback() {
    if (player && playerReady) {
      player.pauseVideo();
    }
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }

  // Loop within current section bounds
  function checkSectionBounds() {
    if (!player || !playerReady || !enabled) return;

    const currentTime = player.getCurrentTime();
    if (currentTime >= sectionEndTime - 0.3) {
      // Loop back to section start
      player.seekTo(sectionStartTime, true);
    }
  }

  // ===== METRIC-DRIVEN UPDATE =====
  function update(metrics) {
    if (!enabled || !player || !playerReady) return;

    const now = Date.now() / 1000;
    const { coverage, delta, cluster_count, symmetry, edge_density, center_of_mass } = metrics;

    // === SILENCE when grid is empty ===
    if (coverage < 0.02) {
      player.setVolume(0);
      updateVisualizer([0, 0, 0, 0, 0, 0]);
      return;
    }

    // === VOLUME from coverage ===
    const effectiveVol = Math.min(1.0, coverage * 2) * (volume / 100);
    player.setVolume(Math.round(effectiveVol * 100));

    // === PLAYBACK RATE from delta (activity) ===
    // Slow (0.75x) when stable, fast (1.25x) when chaotic
    const rate = 0.75 + Math.min(delta * 5, 0.5);
    player.setPlaybackRate(rate);

    // === SECTION SELECTION ===
    // Only change sections when there's a significant change, not every frame
    const minSectionDuration = 4; // Stay in a section for at least 4 seconds
    if (now - lastSectionChange > minSectionDuration) {
      let targetSection = currentSection;

      // Hook: triggered by rapid pattern change (painting, mitosis events)
      if (delta > 0.12) {
        targetSection = 'hook';
      }
      // Chorus: many clusters (complex pattern)
      else if (cluster_count > 30) {
        targetSection = 'chorus';
      }
      // Bridge: high edge density (intricate patterns)
      else if (edge_density > 0.3) {
        targetSection = 'bridge';
      }
      // Verse: default/calm state
      else {
        targetSection = 'verse';
      }

      // Stinger-like: sudden cluster count change triggers hook
      const clusterDelta = Math.abs(cluster_count - lastClusterCount) / Math.max(1, lastClusterCount);
      if (clusterDelta > 0.3 && now - lastSectionChange > 6) {
        targetSection = 'hook';
      }

      if (targetSection !== currentSection) {
        seekToSection(targetSection);
        lastSectionChange = now;
      }
    }

    lastClusterCount = cluster_count;
    lastMetrics = { ...metrics };

    // Update visualizer
    updateVisualizer([
      coverage,
      delta * 5,
      currentSection === 'hook' ? 0.9 : 0.1,
      edge_density,
      cluster_count / 50,
      symmetry
    ]);
  }

  function updateVisualizer(levels) {
    const bars = document.querySelectorAll('.viz-bar');
    bars.forEach((bar, i) => {
      const level = Math.min(1, levels[i] || 0);
      const height = Math.max(3, level * 22);
      bar.style.height = height + 'px';
      bar.classList.toggle('active', level > 0.1);
    });
  }

  // ===== PUBLIC CONTROLS =====
  function toggle() {
    if (enabled) disable();
    else enable();
  }

  function enable() {
    enabled = true;

    document.getElementById('yt-player-wrap').classList.add('visible');

    if (!apiReady) {
      document.getElementById('audio-status').textContent = 'Loading YouTube API...';
      // Wait for API
      const waitForAPI = setInterval(() => {
        if (apiReady) {
          clearInterval(waitForAPI);
          createPlayer(SONGS[currentTheme].videoId);
        }
      }, 200);
    } else if (!playerReady) {
      createPlayer(SONGS[currentTheme].videoId);
    } else {
      startPlayback();
    }

    document.getElementById('audio-status').textContent =
      `Loading: ${SONGS[currentTheme].name}`;
    if (window.updateMusicButton) window.updateMusicButton();
  }

  function disable() {
    enabled = false;
    stopPlayback();
    document.getElementById('yt-player-wrap').classList.remove('visible');
    updateVisualizer([0, 0, 0, 0, 0, 0]);
    document.getElementById('audio-status').textContent = 'Audio stopped';
    if (window.updateMusicButton) window.updateMusicButton();
  }

  function setVolume(v) {
    volume = v;
    if (player && playerReady) {
      player.setVolume(v);
    }
  }

  function setTheme(theme) {
    const wasEnabled = enabled;
    currentTheme = theme;
    currentSection = 'verse';
    lastSectionChange = 0;
    lastClusterCount = 0;

    if (wasEnabled && apiReady) {
      // Load new video
      if (player && playerReady) {
        player.loadVideoById({
          videoId: SONGS[theme].videoId,
          startSeconds: SONGS[theme].sections.verse.start
        });
        sectionStartTime = SONGS[theme].sections.verse.start;
        sectionEndTime = SONGS[theme].sections.verse.end;
      } else {
        createPlayer(SONGS[theme].videoId);
      }
      document.getElementById('audio-status').textContent =
        `Loading: ${SONGS[theme].name}`;
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
