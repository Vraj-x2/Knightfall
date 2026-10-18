import { describe, expect, test } from 'vitest';
import { squareFromPoint } from './useDrag';

const rect = { left: 100, top: 50, width: 400, height: 400 }; // 50px squares

describe('squareFromPoint', () => {
  test('white orientation: top-left is a8, bottom-right is h1', () => {
    expect(squareFromPoint(101, 51, rect, 'w')).toBe('a8');
    expect(squareFromPoint(499, 449, rect, 'w')).toBe('h1');
  });

  test('black orientation is mirrored: top-left is h1, bottom-right is a8', () => {
    expect(squareFromPoint(101, 51, rect, 'b')).toBe('h1');
    expect(squareFromPoint(499, 449, rect, 'b')).toBe('a8');
  });

  test('square boundaries belong to the next square', () => {
    expect(squareFromPoint(149.9, 50, rect, 'w')).toBe('a8');
    expect(squareFromPoint(150, 50, rect, 'w')).toBe('b8');
    expect(squareFromPoint(100, 99.9, rect, 'w')).toBe('a8');
    expect(squareFromPoint(100, 100, rect, 'w')).toBe('a7');
  });

  test('e2 and e7 for both orientations', () => {
    // col 4 -> x 300..349, white row 6 (rank 2) -> y 350..399
    expect(squareFromPoint(320, 370, rect, 'w')).toBe('e2');
    expect(squareFromPoint(320, 120, rect, 'w')).toBe('e7');
    // black: col 3 shows e, row 1 shows rank 2
    expect(squareFromPoint(270, 120, rect, 'b')).toBe('e2');
  });

  test('outside the board returns null', () => {
    expect(squareFromPoint(99, 100, rect, 'w')).toBeNull();
    expect(squareFromPoint(500, 100, rect, 'w')).toBeNull();
    expect(squareFromPoint(200, 49, rect, 'b')).toBeNull();
    expect(squareFromPoint(200, 450, rect, 'b')).toBeNull();
  });
});
