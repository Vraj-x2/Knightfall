import { describe, expect, test } from 'vitest';
import { cellToSquare, moveFocus, squareToCell } from './keyboard';

describe('keyboard focus movement', () => {
  test('arrows move visually on the white board', () => {
    expect(moveFocus('e2', 'ArrowUp', 'w')).toBe('e3');
    expect(moveFocus('e2', 'ArrowDown', 'w')).toBe('e1');
    expect(moveFocus('e2', 'ArrowLeft', 'w')).toBe('d2');
    expect(moveFocus('e2', 'ArrowRight', 'w')).toBe('f2');
  });

  test('arrows move visually on the flipped black board', () => {
    expect(moveFocus('e7', 'ArrowUp', 'b')).toBe('e6');
    expect(moveFocus('e7', 'ArrowDown', 'b')).toBe('e8');
    expect(moveFocus('e7', 'ArrowLeft', 'b')).toBe('f7');
    expect(moveFocus('e7', 'ArrowRight', 'b')).toBe('d7');
  });

  test('focus stops at the board edges', () => {
    expect(moveFocus('a8', 'ArrowUp', 'w')).toBe('a8');
    expect(moveFocus('a8', 'ArrowLeft', 'w')).toBe('a8');
    expect(moveFocus('h1', 'ArrowDown', 'w')).toBe('h1');
    expect(moveFocus('h1', 'ArrowRight', 'w')).toBe('h1');
    expect(moveFocus('h1', 'ArrowUp', 'b')).toBe('h1');
  });

  test('non-arrow keys are ignored', () => {
    expect(moveFocus('e2', 'a', 'w')).toBeNull();
  });

  test('cell and square conversions round-trip for both orientations', () => {
    for (const o of ['w', 'b'] as const) {
      for (const sq of ['a1', 'h1', 'a8', 'h8', 'e4']) {
        const { row, col } = squareToCell(sq, o);
        expect(cellToSquare(row, col, o)).toBe(sq);
      }
    }
    expect(squareToCell('a8', 'w')).toEqual({ row: 0, col: 0 });
    expect(squareToCell('a8', 'b')).toEqual({ row: 7, col: 7 });
  });
});
