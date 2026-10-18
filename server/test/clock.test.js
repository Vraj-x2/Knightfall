import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { afterMove, expiredSide, msUntilFlag, newClock, parseTimeControl, snapshot, stop } from '../clock.js';
import { createRoomStore, hasMatingMaterial } from '../rooms.js';

const T0 = 1_000_000;
const fresh = (baseMs = 60_000, incMs = 0) => newClock({ baseMs, incMs });

describe('parseTimeControl', () => {
  test('accepts whole-second base and increment within bounds', () => {
    assert.deepEqual(parseTimeControl({ base: 300, increment: 3 }), { baseMs: 300_000, incMs: 3_000 });
    assert.deepEqual(parseTimeControl({ base: 3, increment: 0 }), { baseMs: 3_000, incMs: 0 });
  });

  test('rejects anything else', () => {
    for (const bad of [null, 5, 'x', {}, { base: 2, increment: 0 }, { base: 10_801, increment: 0 }, { base: 60, increment: 61 },
      { base: 60, increment: -1 }, { base: 60.5, increment: 0 }, { base: '60', increment: 0 }, { base: 60 }]) {
      assert.equal(parseTimeControl(bad), null, JSON.stringify(bad));
    }
  });
});

describe('clock', () => {
  test('nothing runs until white has made the first move', () => {
    const clock = fresh();
    assert.equal(clock.running, null);
    assert.deepEqual(snapshot(clock, T0 + 99_999), { w: 60_000, b: 60_000, running: null, baseMs: 60_000, incMs: 0 });
  });

  test("white's first move is free and starts black's clock", () => {
    const { clock, flagged } = afterMove(fresh(60_000, 5_000), 'w', 0, T0);
    assert.equal(flagged, false);
    assert.equal(clock.running, 'b');
    assert.deepEqual(snapshot(clock, T0 + 2_000), { w: 60_000, b: 58_000, running: 'b', baseMs: 60_000, incMs: 5_000 });
  });

  test('a move charges the mover, adds the increment and passes the turn', () => {
    const afterWhite = afterMove(fresh(60_000, 5_000), 'w', 0, T0).clock;
    const { clock } = afterMove(afterWhite, 'b', 1, T0 + 12_000);
    assert.deepEqual(snapshot(clock, T0 + 12_000), { w: 60_000, b: 53_000, running: 'w', baseMs: 60_000, incMs: 5_000 });
    const next = afterMove(clock, 'w', 2, T0 + 15_000).clock;
    assert.equal(snapshot(next, T0 + 15_000).w, 62_000); // 60 - 3 + 5
  });

  test('moving after time ran out is a flag, not a move', () => {
    const afterWhite = afterMove(fresh(10_000), 'w', 0, T0).clock;
    const result = afterMove(afterWhite, 'b', 1, T0 + 10_000);
    assert.equal(result.flagged, true);
    assert.equal(result.clock.remaining.b, 0);
    assert.equal(result.clock.running, null);
  });

  test('expiredSide and msUntilFlag follow the running side only', () => {
    const clock = afterMove(fresh(10_000), 'w', 0, T0).clock; // black running
    assert.equal(msUntilFlag(clock, T0 + 4_000), 6_000);
    assert.equal(expiredSide(clock, T0 + 9_999), null);
    assert.equal(expiredSide(clock, T0 + 10_000), 'b');
    assert.equal(msUntilFlag(fresh(), T0), null);
    assert.equal(expiredSide(fresh(), T0 + 1e9), null);
  });

  test('stop freezes the clock, charging the side that was running', () => {
    const clock = afterMove(fresh(60_000), 'w', 0, T0).clock;
    const stopped = stop(clock, T0 + 7_000);
    assert.equal(stopped.running, null);
    assert.equal(snapshot(stopped, T0 + 999_999).b, 53_000);
  });

  test('functions never mutate the clock they are given', () => {
    const clock = fresh();
    const frozen = JSON.stringify(clock);
    afterMove(clock, 'w', 0, T0);
    stop(clock, T0);
    assert.equal(JSON.stringify(clock), frozen);
  });
});

describe('hasMatingMaterial (decides win vs draw when the other side flags)', () => {
  const material = (fen, color) => hasMatingMaterial(new Chess(fen), color);
  test('a pawn, rook or queen is enough', () => {
    assert.equal(material('k7/8/8/8/8/8/4P3/K7 w - - 0 1', 'w'), true);
    assert.equal(material('k7/8/8/8/8/8/8/KR6 w - - 0 1', 'w'), true);
    assert.equal(material('k7/8/8/8/8/8/8/KQ6 w - - 0 1', 'w'), true);
  });
  test('a lone king or a single minor piece is not', () => {
    assert.equal(material('k7/8/8/8/8/8/8/K7 w - - 0 1', 'w'), false);
    assert.equal(material('k7/8/8/8/8/8/8/KN6 w - - 0 1', 'w'), false);
    assert.equal(material('k7/8/8/8/8/8/8/KB6 w - - 0 1', 'w'), false);
  });
  test('two minor pieces are', () => {
    assert.equal(material('k7/8/8/8/8/8/8/KBN5 w - - 0 1', 'w'), true);
  });
  test('only the named colour is counted', () => {
    assert.equal(material('kq6/8/8/8/8/8/8/K7 w - - 0 1', 'w'), false);
    assert.equal(material('kq6/8/8/8/8/8/8/K7 w - - 0 1', 'b'), true);
  });
});

describe('applyMove with a clock', () => {
  function timedRoom(control) {
    const store = createRoomStore();
    const room = store.create(control);
    room.seats.w.socket = {};
    room.seats.b = { token: 'b', socket: {}, name: '', wantsRematch: false };
    return { store, room };
  }
  const e4 = { from: 'e2', to: 'e4', ply: 0 };
  const e5 = { from: 'e7', to: 'e5', ply: 1 };

  test('a move that arrives after the mover ran out of time is a flag, and is not played', () => {
    const { store, room } = timedRoom({ baseMs: 10_000, incMs: 0 });
    assert.deepEqual(Object.keys(store.applyMove(room, 'w', e4, T0)), ['move', 'ply']);
    const late = store.applyMove(room, 'b', e5, T0 + 10_001);
    assert.deepEqual(late, { flagged: true });
    assert.equal(room.moves.length, 1);
    assert.equal(room.clock.remaining.b, 0);
    assert.deepEqual(store.timeoutResult(room, 'b'), { winner: 'w', reason: 'timeout' });
  });

  test('an illegal move leaves the clock untouched', () => {
    const { store, room } = timedRoom({ baseMs: 60_000, incMs: 0 });
    store.applyMove(room, 'w', e4, T0);
    const before = JSON.stringify(room.clock);
    assert.equal(store.applyMove(room, 'b', { from: 'e7', to: 'e3', ply: 1 }, T0 + 5_000).reason, 'ILLEGAL_MOVE');
    assert.equal(JSON.stringify(room.clock), before);
  });

  test('flagging against a side that cannot mate is a draw', () => {
    const { store, room } = timedRoom({ baseMs: 60_000, incMs: 0 });
    room.game.load('k7/8/8/8/8/8/8/KN6 w - - 0 1');
    assert.deepEqual(store.timeoutResult(room, 'b'), { winner: null, reason: 'timeout vs insufficient material' });
    assert.deepEqual(store.timeoutResult(room, 'w'), { winner: null, reason: 'timeout vs insufficient material' }); // black has only a king
    room.game.load('kq6/8/8/8/8/8/8/KN6 w - - 0 1');
    assert.deepEqual(store.timeoutResult(room, 'w'), { winner: 'b', reason: 'timeout' }); // black has a queen
  });
});
