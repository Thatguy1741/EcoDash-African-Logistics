/* ============================================================
   EcoDash - audio.js
   ------------------------------------------------------------
   A tiny procedural sound engine built purely on the Web Audio
   API. No .mp3 / .wav files are needed - every sound is generated
   in code with oscillators + noise. This gives the project
   "Background music & sound effects" with zero external assets.

   Architecture:
     master gain -> sfxGain (one-shot effects)
                 -> musicGain (kalimba-style background loop)
                 -> windGain (looping filtered noise)
                 -> humGain  (the drone's motor hum, follows throttle)

   The browser will NOT let us make sound until the user has
   clicked / pressed a key, so Game.startMission() calls
   Audio.unlock() inside the Start button's click handler.

   Exposed as:  EC.Audio
   ============================================================ */
(function () {
  const EC = (window.EcoDash = window.EcoDash || {});

  let ctx = null;      // AudioContext (created lazily)
  let master = null;   // master gain node (mute control)
  let sfxGain = null;
  let musicGain = null;
  let windGain = null;
  let humGain = null;

  let muted = false;
  let noiseBuffer = null;

  /* ---------- background music: pentatonic "kalimba" loop ----------
     The kalimba (thumb piano) is a Southern African instrument.
     We play a repeating melodic phrase from a MAJOR PENTATONIC scale
     (5 notes per octave - very musical, no "wrong" notes) using a
     gentle sine oscillator with a fast decay to sound plucked.     */

  // Semitone offsets for a C major pentatonic scale (C D E G A).
  const PENTATONIC = [0, 2, 4, 7, 9];
  const BASE_FREQ = 261.63; // C4

  function pentatonicFreq(step) {
    const octave = Math.floor(step / PENTATONIC.length);
    const degree = PENTATONIC[step % PENTATONIC.length];
    return BASE_FREQ * Math.pow(2, octave + degree / 12);
  }

  // A melodic phrase (steps into the pentatonic scale; -1 = rest).
  const MELODY = [0, 4, 7, 9, 7, 4, 2, -1, 4, 7, 11, 9, 7, 4, 2, -1,
                  0, 3, 7, 9, 7, 3, 2, -1, 4, 7, 12, 9, 7, 4, 2, -1];

  let stepIndex = 0;
  let nextNoteTime = 0;
  let musicTimer = null;

  function scheduleMusicStep() {
    while (nextNoteTime < ctx.currentTime + 0.6) {
      const step = MELODY[stepIndex % MELODY.length];
      if (step >= 0) {
        playTone({
          freq: pentatonicFreq(step),
          type: "sine",
          duration: 0.9,
          gain: 0.22,
          when: nextNoteTime,
          dest: musicGain
        });
        // Add a soft "bass" one octave down for warmth.
        playTone({
          freq: pentatonicFreq(step) / 2,
          type: "triangle",
          duration: 1.4,
          gain: 0.16,
          when: nextNoteTime,
          dest: musicGain
        });
      }
      stepIndex += 1;
      nextNoteTime += 0.42; // ~142 bpm
    }
  }

  /* ---------- core helpers ---------- */

  function buildNoiseBuffer() {
    const length = ctx.sampleRate * 1.0; // 1 second of noise
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  // Create a simple oscillator "tone" that fades out smoothly.
  function playTone(opts) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const t0 = opts.when || ctx.currentTime;

    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, t0 + opts.duration);
    }

    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(opts.gain || 0.2, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);

    osc.connect(env);
    env.connect(opts.dest || sfxGain);
    osc.start(t0);
    osc.stop(t0 + opts.duration + 0.05);
  }

  // Burst of filtered noise (used for crashes, wind, "swoosh").
  function playNoise(opts) {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType || "bandpass";
    filter.frequency.value = opts.freq || 1000;

    const env = ctx.createGain();
    const t0 = opts.when || ctx.currentTime;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(opts.gain || 0.3, t0 + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(opts.dest || sfxGain);
    src.start(t0);
    src.stop(t0 + opts.duration + 0.05);
  }

  /* ---------- public sound effects ---------- */

  // Two-note "chime" when a parcel is delivered (major third = happy).
  function playChime() {
    playTone({ freq: 659.25, type: "sine", duration: 0.5, gain: 0.25 });                 // E5
    playTone({ freq: 830.61, type: "sine", duration: 0.7, gain: 0.2, when: ctx.currentTime + 0.08 }); // G#5
    playTone({ freq: 987.77, type: "sine", duration: 0.9, gain: 0.14, when: ctx.currentTime + 0.16 }); // B5
  }

  // "Swoosh" for a close pass - quick down-swept filtered noise.
  function playNearMiss() {
    playNoise({ filterType: "bandpass", freq: 2400, gain: 0.2, duration: 0.4 });
  }

  // Low "thud + rattle" when the drone hits something.
  function playBump(heavy) {
    playTone({ freq: 120, freqEnd: 38, type: "sine", duration: heavy ? 0.35 : 0.22, gain: 0.5 });
    playNoise({ filterType: "lowpass", freq: 500, gain: heavy ? 0.5 : 0.3, duration: heavy ? 0.3 : 0.18 });
  }

  // Two descending beeps when the battery is nearly empty.
  function playAlert() {
    playTone({ freq: 880, freqEnd: 660, type: "square", duration: 0.18, gain: 0.1 });
    playTone({ freq: 660, freqEnd: 494, type: "square", duration: 0.22, gain: 0.1, when: ctx.currentTime + 0.2 });
  }

  // Soft "sparkle" while recharging inside a solar microgrid.
  function playCharge() {
    const t = ctx.currentTime;
    playTone({ freq: 1046.5, type: "sine", duration: 0.3, gain: 0.08, when: t });
    playTone({ freq: 1568.0, type: "sine", duration: 0.4, gain: 0.06, when: t + 0.12 });
  }

  // Tiny click for menu buttons.
  function playClick() {
    playTone({ freq: 1400, freqEnd: 700, type: "sine", duration: 0.06, gain: 0.1 });
  }

  /* ---------- engine lifecycle ---------- */

  // Must be called from a user gesture (click / key press).
  function unlock() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);

    sfxGain = ctx.createGain(); sfxGain.gain.value = 1;    sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
    windGain = ctx.createGain(); windGain.gain.value = 0; windGain.connect(master);
    humGain = ctx.createGain(); humGain.gain.value = 0;    humGain.connect(master);

    buildNoiseBuffer();

    /* --- looping ambient wind (gain is driven by Game each frame) --- */
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuffer;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 320;
    windFilter.Q.value = 0.6;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windSrc.start();

    /* --- drone motor hum (two detuned saws = warm motor sound) --- */
    [71, 71.7].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const humFilter = ctx.createBiquadFilter();
      humFilter.type = "lowpass";
      humFilter.frequency.value = 320;
      osc.connect(humFilter);
      humFilter.connect(humGain);
      osc.start();
    });

    // Start the kalimba scheduler.
    nextNoteTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(scheduleMusicStep, 180);
    return true;
  }

  // Set the wind sound loudness (0..1) - called from Game each frame.
  function setWind(level) {
    if (!ctx) return;
    const target = Math.min(0.35, level * 0.35);
    windGain.gain.setTargetAtTime(target, ctx.currentTime, 0.3);
  }

  // Set the motor hum loudness (0..1 for throttle ratio).
  function setHover(ratio) {
    if (!ctx) return;
    humGain.gain.setTargetAtTime(0.03 + ratio * 0.22, ctx.currentTime, 0.08);
  }

  // Stop the motor (used on pause / game over).
  function stopHover() {
    if (!ctx) return;
    humGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }

  function setMuted(m) {
    muted = !!m;
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
  }

  function isMuted() {
    return muted;
  }

  EC.Audio = {
    unlock,
    setWind,
    setHover,
    stopHover,
    setMuted,
    isMuted,
    playChime,
    playNearMiss,
    playBump,
    playAlert,
    playCharge,
    playClick,
    get isReady() { return !!ctx; }
  };
})();