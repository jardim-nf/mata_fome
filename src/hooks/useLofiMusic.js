import { useState, useRef, useCallback } from 'react';

/**
 * useLofiMusic — Procedural lo-fi ambient music generator using Web Audio API
 * Creates warm pad chords, vinyl crackle, and a soft sub-bass
 * Zero external dependencies, zero audio files needed
 */
export const useLofiMusic = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef(null);
  const nodesRef = useRef(null);

  const start = useCallback(() => {
    if (ctxRef.current) return;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ctx;

    // Master output chain
    const master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);

    // Lo-fi warmth filter
    const lofi = ctx.createBiquadFilter();
    lofi.type = 'lowpass';
    lofi.frequency.value = 900;
    lofi.Q.value = 0.7;
    lofi.connect(master);

    // Reverb simulation via delay + feedback
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.35;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.25;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 1200;
    delay.connect(delayFilter);
    delayFilter.connect(feedback);
    feedback.connect(delay);
    delay.connect(master);

    // === PAD CHORDS (warm sine + triangle blend) ===
    const chordProgressions = [
      [130.81, 164.81, 196.00, 246.94],  // Cmaj7
      [110.00, 138.59, 164.81, 207.65],  // Am7
      [146.83, 174.61, 220.00, 261.63],  // Dm9
      [98.00, 123.47, 146.83, 185.00],   // G7
    ];

    const padGain = ctx.createGain();
    padGain.gain.value = 0.06;
    padGain.connect(lofi);
    padGain.connect(delay); // Also feed reverb

    const oscillators = [];
    chordProgressions[0].forEach(freq => {
      // Sine layer
      const sine = ctx.createOscillator();
      sine.type = 'sine';
      sine.frequency.value = freq;
      sine.connect(padGain);
      sine.start();

      // Triangle layer (softer harmonics)
      const tri = ctx.createOscillator();
      tri.type = 'triangle';
      tri.frequency.value = freq * 2; // octave up
      const triGain = ctx.createGain();
      triGain.gain.value = 0.015;
      tri.connect(triGain);
      triGain.connect(padGain);
      tri.start();

      oscillators.push({ sine, tri });
    });

    // Chord progression cycle
    let chordIndex = 0;
    const chordInterval = setInterval(() => {
      chordIndex = (chordIndex + 1) % chordProgressions.length;
      const chord = chordProgressions[chordIndex];
      oscillators.forEach((pair, i) => {
        const t = ctx.currentTime;
        pair.sine.frequency.setTargetAtTime(chord[i], t, 0.8);
        pair.tri.frequency.setTargetAtTime(chord[i] * 2, t, 0.8);
      });
    }, 5000);

    // === SUB BASS (gentle pulse) ===
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = 65.41; // C2
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.04;
    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 120;
    bass.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(master);
    bass.start();

    // Bass follows chord root
    const bassNotes = [65.41, 55.00, 73.42, 49.00]; // C2, A1, D2, G1
    let bassIndex = 0;
    const bassInterval = setInterval(() => {
      bassIndex = (bassIndex + 1) % bassNotes.length;
      bass.frequency.setTargetAtTime(bassNotes[bassIndex], ctx.currentTime, 0.5);
    }, 5000);

    // === VINYL CRACKLE (filtered white noise) ===
    const noiseLength = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) {
      // Sparse crackle: mostly silence with occasional pops
      noiseData[i] = Math.random() < 0.003
        ? (Math.random() * 2 - 1) * 0.8
        : (Math.random() * 2 - 1) * 0.008;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const noiseHP = ctx.createBiquadFilter();
    noiseHP.type = 'highpass';
    noiseHP.frequency.value = 3000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.35;

    noise.connect(noiseHP);
    noiseHP.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();

    // === SOFT HI-HAT RHYTHM (filtered noise bursts) ===
    const hatGain = ctx.createGain();
    hatGain.gain.value = 0;
    const hatFilter = ctx.createBiquadFilter();
    hatFilter.type = 'bandpass';
    hatFilter.frequency.value = 8000;
    hatFilter.Q.value = 2;
    hatGain.connect(hatFilter);
    hatFilter.connect(master);

    // Create a noise source for hat
    const hatNoise = ctx.createBufferSource();
    const hatBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const hatData = hatBuffer.getChannelData(0);
    for (let i = 0; i < ctx.sampleRate; i++) {
      hatData[i] = (Math.random() * 2 - 1);
    }
    hatNoise.buffer = hatBuffer;
    hatNoise.loop = true;
    hatNoise.connect(hatGain);
    hatNoise.start();

    // Simple hi-hat pattern: soft ticks
    const bpm = 72;
    const beatMs = (60 / bpm) * 1000;
    const hatInterval = setInterval(() => {
      const t = ctx.currentTime;
      hatGain.gain.setValueAtTime(0.015, t);
      hatGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    }, beatMs / 2);

    nodesRef.current = {
      oscillators, bass, noise, hatNoise,
      chordInterval, bassInterval, hatInterval,
      master
    };
    setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    const nodes = nodesRef.current;
    if (!nodes) return;

    clearInterval(nodes.chordInterval);
    clearInterval(nodes.bassInterval);
    clearInterval(nodes.hatInterval);

    nodes.oscillators?.forEach(pair => {
      try { pair.sine.stop(); } catch (e) {}
      try { pair.tri.stop(); } catch (e) {}
    });
    try { nodes.bass?.stop(); } catch (e) {}
    try { nodes.noise?.stop(); } catch (e) {}
    try { nodes.hatNoise?.stop(); } catch (e) {}

    ctxRef.current?.close();
    ctxRef.current = null;
    nodesRef.current = null;
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) stop(); else start();
  }, [isPlaying, start, stop]);

  return { isPlaying, start, stop, toggle };
};
