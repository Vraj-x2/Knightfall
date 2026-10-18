import { describe, expect, test } from 'vitest';
import type { MoveRecord } from '../net/protocol';
import { capturedBy, lastMoveText, localResult, materialDiff, replay } from './selectors';
import { initialState } from './gameReducer';

const mv = (from: string, to: string, san: string, promotion?: string): MoveRecord => ({ from, to, san, promotion });

describe('captured pieces and material', () => {
  test('starting position: nothing captured, level material', () => {
    const game = replay([]);
    expect(capturedBy(game)).toEqual({ w: [], b: [] });
    expect(materialDiff(game)).toBe(0);
  });

  test('1.e4 d5 2.exd5: white took a pawn and leads by 1', () => {
    const game = replay([mv('e2', 'e4', 'e4'), mv('d7', 'd5', 'd5'), mv('e4', 'd5', 'exd5')]);
    expect(capturedBy(game)).toEqual({ w: ['p'], b: [] });
    expect(materialDiff(game)).toBe(1);
  });

  test('captured pieces are listed most valuable first', () => {
    // 1.e4 d5 2.exd5 Qxd5 3.Nc3 Qxg2?? -> black took a queen? no: black queen takes g2 pawn
    const game = replay([
      mv('e2', 'e4', 'e4'), mv('d7', 'd5', 'd5'), mv('e4', 'd5', 'exd5'),
      mv('d8', 'd5', 'Qxd5'), mv('b1', 'c3', 'Nc3'), mv('d5', 'a5', 'Qa5'),
      mv('c3', 'e4', 'Ne4'), mv('a5', 'a2', 'Qxa2'), mv('a1', 'a2', 'Rxa2'),
    ]);
    expect(capturedBy(game).w).toEqual(['q', 'p']);
    expect(capturedBy(game).b).toEqual(['p', 'p']);
  });

  test('material follows the board, so promotion counts', () => {
    // White pawn promotes on a queen-less, king-only position.
    const game = replay([]);
    game.load('k7/4P3/8/8/8/8/8/K7 w - - 0 1');
    game.move({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(materialDiff(game)).toBe(9);
  });
});

describe('lastMoveText', () => {
  test('names the mover relative to the player', () => {
    const state = { ...initialState('r'), myColor: 'w' as const, moves: [mv('e2', 'e4', 'e4'), mv('e7', 'e5', 'e5')] };
    expect(lastMoveText(state)).toBe('Opponent played e5');
    expect(lastMoveText({ ...state, moves: state.moves.slice(0, 1) })).toBe('You played e4');
    expect(lastMoveText({ ...state, moves: [] })).toBe('');
  });
});

describe('localResult (game over without a server)', () => {
  const at = (fen: string) => {
    const game = replay([]);
    game.load(fen);
    return game;
  };
  const shuffle = (n: number): MoveRecord[] =>
    Array.from({ length: n }, (_, i) => [mv('g1', 'f3', 'Nf3'), mv('g8', 'f6', 'Nf6'), mv('f3', 'g1', 'Ng1'), mv('f6', 'g8', 'Ng8')][i % 4]);

  test('a game in progress has no result', () => {
    expect(localResult(replay([]))).toBeNull();
  });

  test("checkmate: the side that did not just get mated wins (fool's mate)", () => {
    const game = replay([mv('f2', 'f3', 'f3'), mv('e7', 'e5', 'e5'), mv('g2', 'g4', 'g4'), mv('d8', 'h4', 'Qh4#')]);
    expect(localResult(game)).toEqual({ winner: 'b', reason: 'checkmate' });
  });

  test('stalemate, insufficient material and the 50-move rule are draws', () => {
    expect(localResult(at('k7/8/1Q6/8/8/8/8/7K b - - 0 1'))).toEqual({ winner: null, reason: 'stalemate' });
    expect(localResult(at('k7/8/8/8/8/8/8/KN6 w - - 0 1'))).toEqual({ winner: null, reason: 'insufficient material' });
    expect(localResult(at('k7/8/8/8/8/8/8/K6R w - - 100 80'))).toEqual({ winner: null, reason: '50-move rule' });
  });

  test('threefold repetition needs the move history, not just the position', () => {
    expect(localResult(replay(shuffle(8)))).toEqual({ winner: null, reason: 'threefold repetition' });
    expect(localResult(replay(shuffle(4)))).toBeNull();
  });
});
