import type { ClockSnapshot, Color } from '../net/protocol';

// A server snapshot plus when this browser received it, so we can tick locally between updates.
export type ClockState = ClockSnapshot & { receivedAt: number };

export function remainingMs(clock: ClockState, color: Color, now: number): number {
  const elapsed = clock.running === color ? Math.max(0, now - clock.receivedAt) : 0;
  return Math.max(0, clock[color] - elapsed);
}

const pad = (n: number) => String(n).padStart(2, '0');

// Whole seconds (rounded up, so it only reads 0:00 at zero), tenths below ten seconds.
export function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  if (total < 10_000) {
    const tenths = Math.floor(total / 100);
    return `0:${pad(Math.floor(tenths / 10))}.${tenths % 10}`;
  }
  const seconds = Math.ceil(total / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${minutes}:${pad(seconds % 60)}`;
}
