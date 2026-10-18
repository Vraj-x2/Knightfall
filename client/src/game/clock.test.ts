import { describe, expect, test } from 'vitest';
import { formatClock, remainingMs, type ClockState } from './clock';

const clock = (over: Partial<ClockState> = {}): ClockState => ({
  w: 60_000,
  b: 45_000,
  running: 'b',
  baseMs: 60_000,
  incMs: 0,
  receivedAt: 1_000,
  ...over,
});

describe('remainingMs', () => {
  test('only the running side counts down between server updates', () => {
    expect(remainingMs(clock(), 'b', 3_500)).toBe(42_500);
    expect(remainingMs(clock(), 'w', 3_500)).toBe(60_000);
  });

  test('nobody counts down when the clock is not running', () => {
    const idle = clock({ running: null });
    expect(remainingMs(idle, 'b', 99_999)).toBe(45_000);
  });

  test('never goes below zero', () => {
    expect(remainingMs(clock(), 'b', 500_000)).toBe(0);
  });
});

describe('formatClock', () => {
  test.each([
    [600_000, '10:00'],
    [59_001, '1:00'], // rounds up so the display only reads 0:00 at zero
    [10_000, '0:10'],
    [9_999, '0:09.9'],
    [9_400, '0:09.4'],
    [100, '0:00.1'],
    [0, '0:00.0'],
    [-5, '0:00.0'],
    [3_725_000, '1:02:05'],
  ])('%i ms -> %s', (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });
});
