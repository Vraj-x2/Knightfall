import { describe, expect, test } from 'vitest';
import { soundKindFor } from './sounds';

describe('soundKindFor', () => {
  test.each([
    ['e4', 'move'],
    ['Nf3', 'move'],
    ['exd5', 'capture'],
    ['Qxh7', 'capture'],
    ['Bb5+', 'check'],
    ['Qxf7+', 'check'],
    ['Qh4#', 'end'],
    ['O-O', 'castle'],
    ['O-O-O+', 'castle'],
    ['e8=Q', 'move'],
  ])('%s -> %s', (san, kind) => {
    expect(soundKindFor(san)).toBe(kind);
  });
});
