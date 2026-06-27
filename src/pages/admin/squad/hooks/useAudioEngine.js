import { useRef, useEffect, useCallback } from 'react';

/**
 * useAudioEngine — Procedural sound synthesis using Web Audio API.
 * No external audio files needed.
 * 
 * @param {boolean} muted - Whether audio is muted
 * @returns {{ playSynthSound: Function, initAudio: Function }}
 */
export function useAudioEngine(muted) {
  const audioCtxRef = useRef(null);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
  }, []);

  const playSynthSound = useCallback((type, agentId = null) => {
    if (mutedRef.current) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'hum') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 1.5);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        osc.start();
        osc.stop(ctx.currentTime + 1.5);
      } else if (type === 'click') {
        let baseFreq = 600;
        let endFreq = 300;
        if (agentId === 'oscar') { baseFreq = 400; endFreq = 200; }
        else if (agentId === 'leo') { baseFreq = 800; endFreq = 400; }
        else if (agentId === 'afrodite') { baseFreq = 650; endFreq = 350; }
        else if (agentId === 'thor') { baseFreq = 250; endFreq = 100; }
        else if (agentId === 'sabotagem') { baseFreq = 500; endFreq = 250; }

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'warning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } else if (type === 'success') {
        const playTone = (freq, delay, duration, vol) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
          o.connect(g);
          g.connect(ctx.destination);
          g.gain.setValueAtTime(vol, ctx.currentTime + delay);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
          o.start(ctx.currentTime + delay);
          o.stop(ctx.currentTime + delay + duration);
        };
        playTone(523.25, 0, 0.5, 0.03); // C5
        playTone(659.25, 0.08, 0.5, 0.03); // E5
        playTone(783.99, 0.16, 0.6, 0.03); // G5
        playTone(1046.50, 0.24, 0.8, 0.04); // C6
      }
    } catch (e) {
      console.warn("Audio synthesis error:", e);
    }
  }, [initAudio]);

  return { playSynthSound, initAudio };
}
