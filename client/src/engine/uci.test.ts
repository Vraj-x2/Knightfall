import { describe, expect, test } from 'vitest';
import { goCommand, parseBestMove, positionCommand } from './uci';

describe('positionCommand', () => {
  test('starting position when no moves have been played', () => {
    expect(positionCommand([])).toBe('position startpos');
  });

  test('moves are joined in long algebraic form, including promotions', () => {
    expect(
      positionCommand([
        { from: 'e2', to: 'e4' },
        { from: 'e7', to: 'e5' },
        { from: 'a7', to: 'a8', promotion: 'q' },
      ]),
    ).toBe('position startpos moves e2e4 e7e5 a7a8q');
  });

  test('castling is the king moving two squares, as chess.js records it', () => {
    expect(positionCommand([{ from: 'e1', to: 'g1' }])).toBe('position startpos moves e1g1');
  });
});

describe('goCommand', () => {
  test('limits thinking time', () => {
    expect(goCommand(800)).toBe('go movetime 800');
  });
});

describe('parseBestMove', () => {
  test('ignores lines that are not a bestmove', () => {
    expect(parseBestMove('info depth 12 score cp 31 pv e2e4')).toBeNull();
    expect(parseBestMove('readyok')).toBeNull();
    expect(parseBestMove('')).toBeNull();
  });

  test('reads a plain move and ignores the ponder suffix', () => {
    expect(parseBestMove('bestmove e7e5 ponder g1f3')).toEqual({ move: { from: 'e7', to: 'e5' } });
    expect(parseBestMove('bestmove g1f3')).toEqual({ move: { from: 'g1', to: 'f3' } });
  });

  test('reads promotions', () => {
    expect(parseBestMove('bestmove e7e8n')).toEqual({ move: { from: 'e7', to: 'e8', promotion: 'n' } });
  });

  test('"(none)" means the engine has no legal move', () => {
    expect(parseBestMove('bestmove (none)')).toEqual({ move: null });
  });

  test('a malformed move is treated as no move rather than guessed at', () => {
    expect(parseBestMove('bestmove zz9')).toEqual({ move: null });
  });
});
