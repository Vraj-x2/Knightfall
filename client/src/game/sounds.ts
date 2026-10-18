import { readItem, writeItem } from '../storage';

// Synthesised with Web Audio so there are no asset files to ship or license.
export type SoundKind = 'move' | 'capture' | 'check' | 'castle' | 'end';

const MUTE_KEY = 'chess-muted';
let ctx: AudioContext | null = null;
let muted: boolean | null = null;

export function soundKindFor(san: string): SoundKind {
  if (san.endsWith('#')) return 'end';
  if (san.startsWith('O-O')) return 'castle';
  if (san.endsWith('+')) return 'check';
  if (san.includes('x')) return 'capture';
  return 'move';
}

export function isMuted(): boolean {
  if (muted === null) {
    muted = readItem(MUTE_KEY) === '1';
  }
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  writeItem(MUTE_KEY, value ? '1' : '0');
}

function tone(audio: AudioContext, freq: number, at: number, duration: number, gain: number, type: OscillatorType) {
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(amp).connect(audio.destination);
  osc.start(at);
  osc.stop(at + duration);
}

export function playSound(kind: SoundKind) {
  if (isMuted() || typeof AudioContext === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    switch (kind) {
      case 'move':
        tone(ctx, 190, t, 0.07, 0.35, 'triangle');
        break;
      case 'capture':
        tone(ctx, 140, t, 0.1, 0.5, 'triangle');
        tone(ctx, 90, t, 0.12, 0.4, 'square');
        break;
      case 'castle':
        tone(ctx, 190, t, 0.07, 0.35, 'triangle');
        tone(ctx, 230, t + 0.09, 0.07, 0.35, 'triangle');
        break;
      case 'check':
        tone(ctx, 190, t, 0.07, 0.35, 'triangle');
        tone(ctx, 660, t + 0.06, 0.18, 0.2, 'sine');
        break;
      case 'end':
        tone(ctx, 523, t, 0.25, 0.25, 'sine');
        tone(ctx, 392, t + 0.15, 0.25, 0.25, 'sine');
        tone(ctx, 262, t + 0.3, 0.45, 0.25, 'sine');
        break;
    }
  } catch {
    // Audio unavailable or blocked until a user gesture; the game still works silently.
  }
}
