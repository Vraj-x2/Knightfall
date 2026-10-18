import { describe, expect, test } from 'vitest';
import { gameReducer, initialState, type GameState } from './gameReducer';
import type { MoveRecord } from '../net/protocol';

const e4: MoveRecord = { from: 'e2', to: 'e4', san: 'e4' };
const e5: MoveRecord = { from: 'e7', to: 'e5', san: 'e5' };
const d4: MoveRecord = { from: 'd2', to: 'd4', san: 'd4' };

const base = (over: Partial<GameState> = {}): GameState => ({ ...initialState('room1'), ...over });

describe('gameReducer', () => {
  test('JOINED sets colour, moves, opponent and result', () => {
    const result = { winner: 'w' as const, reason: 'checkmate' };
    const rematch = { mine: false, theirs: true };
    const next = gameReducer(base(), { type: 'JOINED', color: 'b', moves: [e4], opponentOnline: true, opponentName: 'Alice', result, rematch });
    expect(next).toMatchObject({ myColor: 'b', moves: [e4], opponentOnline: true, opponentName: 'Alice', result, rematch });
  });

  test('SELECT and DESELECT toggle the selected square', () => {
    const selected = gameReducer(base(), { type: 'SELECT', square: 'e2' });
    expect(selected.selected).toBe('e2');
    expect(gameReducer(selected, { type: 'DESELECT' }).selected).toBeNull();
  });

  test('LOCAL_MOVE appends optimistically and clears selection', () => {
    const next = gameReducer(base({ selected: 'e2' }), { type: 'LOCAL_MOVE', move: e4 });
    expect(next.moves).toEqual([e4]);
    expect(next.selected).toBeNull();
  });

  test('SERVER_MOVE appends the opponent move at the expected ply', () => {
    const next = gameReducer(base({ moves: [e4] }), { type: 'SERVER_MOVE', move: e5, ply: 1 });
    expect(next.moves).toEqual([e4, e5]);
  });

  test('SERVER_MOVE echo of our optimistic move changes nothing', () => {
    const state = base({ moves: [e4] });
    expect(gameReducer(state, { type: 'SERVER_MOVE', move: e4, ply: 0 })).toBe(state);
  });

  test('SERVER_MOVE that disagrees with an optimistic move replaces it', () => {
    const next = gameReducer(base({ moves: [e4] }), { type: 'SERVER_MOVE', move: d4, ply: 0 });
    expect(next.moves).toEqual([d4]);
  });

  test('SERVER_MOVE with a gap is ignored until a sync arrives', () => {
    const state = base({ moves: [e4] });
    expect(gameReducer(state, { type: 'SERVER_MOVE', move: e4, ply: 5 })).toBe(state);
  });

  test('SERVER_SYNC overrides an optimistic move with the server list', () => {
    const optimistic = gameReducer(base({ moves: [e4, e5] }), { type: 'LOCAL_MOVE', move: d4 });
    const next = gameReducer(optimistic, { type: 'SERVER_SYNC', moves: [e4, e5] });
    expect(next.moves).toEqual([e4, e5]);
  });

  test('promotion start and cancel', () => {
    const started = gameReducer(base({ selected: 'a7' }), { type: 'START_PROMOTION', from: 'a7', to: 'a8' });
    expect(started.pendingPromotion).toEqual({ from: 'a7', to: 'a8' });
    const cancelled = gameReducer(started, { type: 'CANCEL_PROMOTION' });
    expect(cancelled).toMatchObject({ pendingPromotion: null, selected: null });
  });

  test('SET_CONNECTION, OPPONENT_STATUS and GAME_OVER', () => {
    let s = gameReducer(base(), { type: 'SET_CONNECTION', connection: 'open' });
    s = gameReducer(s, { type: 'OPPONENT_STATUS', online: true });
    s = gameReducer(s, { type: 'GAME_OVER', result: { winner: null, reason: 'stalemate' } });
    expect(s).toMatchObject({ connection: 'open', opponentOnline: true, result: { winner: null, reason: 'stalemate' } });
  });

  test('VIEW_PLY rewinds, clamps, and null or the live ply returns to live', () => {
    const state = base({ moves: [e4, e5, d4] });
    expect(gameReducer(state, { type: 'VIEW_PLY', ply: 1 }).viewPly).toBe(1);
    expect(gameReducer(state, { type: 'VIEW_PLY', ply: 0 }).viewPly).toBe(0);
    expect(gameReducer(state, { type: 'VIEW_PLY', ply: -4 }).viewPly).toBe(0);
    expect(gameReducer(state, { type: 'VIEW_PLY', ply: 3 }).viewPly).toBeNull();
    expect(gameReducer(base({ moves: [e4], viewPly: 0 }), { type: 'VIEW_PLY', ply: null }).viewPly).toBeNull();
  });

  test('an incoming opponent move keeps the rewound view in place', () => {
    const next = gameReducer(base({ moves: [e4], viewPly: 0 }), { type: 'SERVER_MOVE', move: e5, ply: 1 });
    expect(next.moves).toEqual([e4, e5]);
    expect(next.viewPly).toBe(0);
  });

  test('SERVER_SYNC and JOINED return to live', () => {
    const viewing = base({ moves: [e4, e5], viewPly: 1 });
    expect(gameReducer(viewing, { type: 'SERVER_SYNC', moves: [e4, e5] }).viewPly).toBeNull();
    const joined = gameReducer(viewing, { type: 'JOINED', color: 'w', moves: [e4], opponentOnline: true, opponentName: '', result: null, rematch: { mine: false, theirs: false } });
    expect(joined.viewPly).toBeNull();
  });

  test('OPPONENT_NAME stores the name', () => {
    expect(gameReducer(base(), { type: 'OPPONENT_NAME', name: 'Bob' }).opponentName).toBe('Bob');
  });

  test('rematch: requesting and being offered are tracked separately', () => {
    const asked = gameReducer(base(), { type: 'REMATCH_REQUESTED' });
    expect(asked.rematch).toEqual({ mine: true, theirs: false });
    const both = gameReducer(asked, { type: 'REMATCH_OFFERED' });
    expect(both.rematch).toEqual({ mine: true, theirs: true });
  });

  test('REMATCH_STARTED resets the board, swaps colour and clears the result', () => {
    const finished = base({
      myColor: 'w',
      moves: [e4, e5],
      selected: 'e2',
      viewPly: 1,
      result: { winner: 'b', reason: 'checkmate' },
      rematch: { mine: true, theirs: true },
      opponentOnline: true,
      opponentName: 'Bob',
    });
    const next = gameReducer(finished, { type: 'REMATCH_STARTED', color: 'b' });
    expect(next).toMatchObject({
      myColor: 'b',
      moves: [],
      selected: null,
      viewPly: null,
      result: null,
      rematch: { mine: false, theirs: false },
      opponentOnline: true,
      opponentName: 'Bob',
    });
  });

  test('CLOCK_SYNC stores the clock and REMATCH_STARTED drops the old one', () => {
    const clock = { w: 1000, b: 2000, running: 'w' as const, baseMs: 5000, incMs: 0, receivedAt: 7 };
    const synced = gameReducer(base(), { type: 'CLOCK_SYNC', clock });
    expect(synced.clock).toEqual(clock);
    expect(gameReducer(synced, { type: 'REMATCH_STARTED', color: 'b' }).clock).toBeNull();
  });

  test('GAME_OVER freezes a running clock', () => {
    const clock = { w: 1000, b: 2000, running: 'b' as const, baseMs: 5000, incMs: 0, receivedAt: 7 };
    const over = gameReducer(base({ clock }), { type: 'GAME_OVER', result: { winner: 'w', reason: 'timeout' } });
    expect(over.clock).toMatchObject({ w: 1000, b: 2000, running: null });
    expect(gameReducer(base(), { type: 'GAME_OVER', result: { winner: null, reason: 'stalemate' } }).clock).toBeNull();
  });
});
