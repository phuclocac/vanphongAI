import { getSoundPreset } from '../core/workModes';
import type { SoundEngineApi } from '../types/office';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function createSoundEngine(isEnabled: () => boolean): SoundEngineApi {
  let audioCtx: AudioContext | null = null;

  function getCtx(): AudioContext | null {
    if (!isEnabled()) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) {
      try {
        audioCtx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playPreset(name: string): void {
    const ctx = getCtx();
    if (!ctx) return;
    const notes = getSoundPreset(name);
    const now = ctx.currentTime;
    notes.forEach((n) => {
      try {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = n.type || 'sine';
        const startAt = now + (n.delay || 0);
        osc.frequency.setValueAtTime(n.freq, startAt);
        if (n.endFreq && n.endFreq !== n.freq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(40, n.endFreq), startAt + n.duration);
        }
        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.linearRampToValueAtTime(n.gain || 0.05, startAt + 0.008);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + n.duration);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + n.duration + 0.02);
      } catch {
        // Ignore audio scheduling errors safely
      }
    });
  }

  function playElectricZap(): void {
    const ctx = getCtx();
    if (!ctx) return;
    playPreset('electricZap');
    try {
      const sampleRate = ctx.sampleRate || 44100;
      const length = Math.floor(sampleRate * 0.085);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1850;
      filter.Q.value = 2.2;
      const gainNode = ctx.createGain();
      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(0.024, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.09);
    } catch {
      // Ignore audio scheduling errors safely
    }
  }

  function playErrorAlert(errorType = 'api'): void {
    const safeType =
      errorType === 'timeout' ? 'errorTimeout' : errorType === 'network' ? 'errorNetwork' : 'errorApi';
    playPreset(safeType);
  }

  return {
    playClick: () => playPreset('click'),
    playBeatTransition: (beatNum: 2 | 3) => playPreset(beatNum === 2 ? 'beat2' : 'beat3'),
    playExecutiveComplete: () => playPreset('complete'),
    playElectricZap,
    playErrorAlert,
  };
}
