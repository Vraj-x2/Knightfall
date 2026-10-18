import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const PORT = 8192;
const URL = `ws://127.0.0.1:${PORT}`;
const ORIGIN = { headers: { Origin: 'http://localhost:5173' } };
let server;

before(async () => {
  server = spawn('node', ['index.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve) => server.stdout.on('data', (d) => d.toString().includes('listening') && resolve()));
});
after(() => server.kill());

function client() {
  const ws = new WebSocket(URL, ORIGIN);
  const inbox = [];
  const waiters = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    const i = waiters.findIndex((w) => w.type === msg.type);
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
    else inbox.push(msg);
  });
  return {
    ws,
    opened: new Promise((resolve, reject) => ws.on('open', resolve).on('error', reject)),
    send: (msg) => ws.send(JSON.stringify(msg)),
    next: (type, ms = 2000) =>
      new Promise((resolve, reject) => {
        const i = inbox.findIndex((m) => m.type === type);
        if (i >= 0) return resolve(inbox.splice(i, 1)[0]);
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), ms);
        waiters.push({ type, resolve: (m) => (clearTimeout(timer), resolve(m)) });
      }),
    none: async (type) => {
      await new Promise((r) => setTimeout(r, 150));
      assert.equal(inbox.some((m) => m.type === type), false, `unexpected ${type}`);
    },
  };
}

// Creates a room and seats two players. Returns both clients plus their join payloads.
async function startRoom({ whiteName, blackName, timeControl } = {}) {
  const creator = client();
  await creator.opened;
  creator.send({ type: 'create', timeControl });
  const created = await creator.next('created');
  creator.ws.close();
  const white = client();
  await white.opened;
  white.send({ type: 'join', roomId: created.roomId, token: created.token, name: whiteName });
  const whiteJoin = await white.next('joined');
  const black = client();
  await black.opened;
  black.send({ type: 'join', roomId: created.roomId, name: blackName });
  const blackJoin = await black.next('joined');
  return { roomId: created.roomId, white, black, whiteJoin, blackJoin };
}

async function play(room, moves) {
  for (let ply = 0; ply < moves.length; ply++) {
    const [from, to] = moves[ply];
    (ply % 2 === 0 ? room.white : room.black).send({ type: 'move', from, to, ply });
    await room.white.next('move');
    await room.black.next('move');
  }
}

const FOOLS_MATE = [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']];

describe('rooms and moves', () => {
  test('rejects a bad origin', async () => {
    const bad = new WebSocket(URL, { headers: { Origin: 'https://evil.example' } });
    await new Promise((resolve) => bad.on('error', resolve));
  });

  test('seats, full room, unknown room', async () => {
    const room = await startRoom();
    assert.equal(room.whiteJoin.color, 'w');
    assert.equal(room.blackJoin.color, 'b');
    assert.equal(room.blackJoin.opponentOnline, true);
    const third = client();
    await third.opened;
    third.send({ type: 'join', roomId: room.roomId });
    assert.equal((await third.next('error')).code, 'ROOM_FULL');
    third.send({ type: 'join', roomId: 'nope1234' });
    assert.equal((await third.next('error')).code, 'ROOM_NOT_FOUND');
  });

  test('illegal, out-of-turn and stale moves are rejected with the move list', async () => {
    const room = await startRoom();
    room.black.send({ type: 'move', from: 'e7', to: 'e5', ply: 0 });
    assert.equal((await room.black.next('rejected')).reason, 'NOT_YOUR_TURN');
    room.white.send({ type: 'move', from: 'e2', to: 'e5', ply: 0 });
    const illegal = await room.white.next('rejected');
    assert.equal(illegal.reason, 'ILLEGAL_MOVE');
    assert.deepEqual(illegal.moves, []);
    room.white.send({ type: 'move', from: 'f2', to: 'f3', ply: 5 });
    assert.equal((await room.white.next('rejected')).reason, 'STALE_PLY');
  });

  test("fool's mate ends the game and a refresh restores colour, moves and result", async () => {
    const room = await startRoom();
    await play(room, FOOLS_MATE);
    const over = await room.white.next('game_over');
    assert.deepEqual(over, { type: 'game_over', winner: 'b', reason: 'checkmate' });
    room.black.ws.close();
    await room.white.next('opponent_left');
    const again = client();
    await again.opened;
    again.send({ type: 'join', roomId: room.roomId, token: room.blackJoin.token });
    const rejoined = await again.next('joined');
    assert.equal(rejoined.color, 'b');
    assert.equal(rejoined.moves.length, 4);
    assert.equal(rejoined.result.reason, 'checkmate');
    await room.white.next('opponent_back');
  });

  test('resign, oversize messages and the rate limit', async () => {
    const room = await startRoom();
    room.black.send({ type: 'resign' });
    const over = await room.white.next('game_over');
    assert.deepEqual([over.winner, over.reason], ['w', 'resignation']);
    room.white.send({ type: 'ping', pad: 'x'.repeat(2000) });
    room.white.send({ type: 'ping' });
    await room.white.next('pong');
    for (let i = 0; i < 40; i++) room.white.send({ type: 'ping' });
    assert.equal((await room.white.next('error')).code, 'RATE_LIMIT');
  });
});

describe('rematch', () => {
  test('is ignored while the game is still in progress', async () => {
    const room = await startRoom();
    room.white.send({ type: 'rematch' });
    await room.black.none('rematch_offered');
  });

  test('needs both players, then restarts with colours swapped', async () => {
    const room = await startRoom();
    await play(room, FOOLS_MATE);
    await room.white.next('game_over');
    await room.black.next('game_over');

    room.white.send({ type: 'rematch' });
    await room.black.next('rematch_offered');
    await room.white.none('rematch_started');

    room.black.send({ type: 'rematch' });
    assert.deepEqual(await room.white.next('rematch_started'), { type: 'rematch_started', color: 'b', clock: null });
    assert.deepEqual(await room.black.next('rematch_started'), { type: 'rematch_started', color: 'w', clock: null });

    // The new white (the old black player) moves first on a fresh board.
    room.black.send({ type: 'move', from: 'e2', to: 'e4', ply: 0 });
    const move = await room.white.next('move');
    assert.equal(move.san, 'e4');
    await room.black.next('move');
  });

  test('a player who refreshes after the swap keeps their seat, now with the new colour', async () => {
    const room = await startRoom();
    await play(room, FOOLS_MATE);
    room.white.send({ type: 'rematch' });
    room.black.send({ type: 'rematch' });
    await room.white.next('rematch_started');
    room.white.ws.close();
    const again = client();
    await again.opened;
    again.send({ type: 'join', roomId: room.roomId, token: room.whiteJoin.token });
    const joined = await again.next('joined');
    assert.equal(joined.color, 'b');
    assert.deepEqual(joined.moves, []);
    assert.equal(joined.result, null);
    assert.deepEqual(joined.rematch, { mine: false, theirs: false });
  });

  test('a pending offer survives a refresh', async () => {
    const room = await startRoom();
    room.black.send({ type: 'resign' });
    await room.white.next('game_over');
    room.white.send({ type: 'rematch' });
    await room.black.next('rematch_offered');
    room.black.ws.close();
    await room.white.next('opponent_left');
    const again = client();
    await again.opened;
    again.send({ type: 'join', roomId: room.roomId, token: room.blackJoin.token });
    assert.deepEqual((await again.next('joined')).rematch, { mine: false, theirs: true });
  });
});

describe('player names', () => {
  test('are shared at join time', async () => {
    const room = await startRoom({ whiteName: 'Alice', blackName: 'Bob' });
    assert.equal(room.whiteJoin.opponentName, '');
    assert.equal(room.blackJoin.opponentName, 'Alice');
    const joinedNotice = await room.white.next('opponent_joined');
    assert.equal(joinedNotice.name, 'Bob');
  });

  test('can be changed live and the opponent is told', async () => {
    const room = await startRoom();
    room.white.send({ type: 'set_name', name: '  Carol  ' });
    assert.deepEqual(await room.black.next('opponent_name'), { type: 'opponent_name', name: 'Carol' });
  });

  test('are stripped of control and invisible characters and capped at 20', async () => {
    const room = await startRoom();
    room.white.send({ type: 'set_name', name: 'A‮b​c\u0007d' + 'x'.repeat(40) });
    const { name } = await room.black.next('opponent_name');
    assert.equal(name, 'Abcd' + 'x'.repeat(16));
    assert.equal(name.length, 20);
  });

  test('must be a string', async () => {
    const room = await startRoom();
    room.white.send({ type: 'set_name', name: 42 });
    assert.equal((await room.white.next('error')).code, 'BAD_MESSAGE');
  });

  test('a returning player keeps their name and the opponent sees it', async () => {
    const room = await startRoom({ whiteName: 'Alice' });
    room.white.ws.close();
    await room.black.next('opponent_left');
    const again = client();
    await again.opened;
    again.send({ type: 'join', roomId: room.roomId, token: room.whiteJoin.token });
    await again.next('joined');
    assert.equal((await room.black.next('opponent_back')).name, 'Alice');
  });
});

describe('chess clock', () => {
  test('an untimed room has no clock anywhere', async () => {
    const room = await startRoom();
    assert.equal(room.whiteJoin.clock, null);
    room.white.send({ type: 'move', from: 'e2', to: 'e4', ply: 0 });
    assert.equal((await room.white.next('move')).clock, null);
  });

  test('a bad time control is refused', async () => {
    const creator = client();
    await creator.opened;
    creator.send({ type: 'create', timeControl: { base: 1, increment: 0 } });
    assert.equal((await creator.next('error')).code, 'BAD_MESSAGE');
  });

  test('is idle until white moves, then black\'s clock runs and both players see it', async () => {
    const room = await startRoom({ timeControl: { base: 60, increment: 5 } });
    assert.deepEqual(room.whiteJoin.clock, { w: 60_000, b: 60_000, running: null, baseMs: 60_000, incMs: 5_000 });
    room.white.send({ type: 'move', from: 'e2', to: 'e4', ply: 0 });
    for (const player of [room.white, room.black]) {
      const { clock } = await player.next('move');
      assert.equal(clock.running, 'b');
      assert.equal(clock.w, 60_000);
    }
  });

  test('increment is added after a move and the clock is restored on refresh', async () => {
    const room = await startRoom({ timeControl: { base: 60, increment: 5 } });
    await play(room, [['e2', 'e4'], ['e7', 'e5']]);
    room.black.ws.close();
    await room.white.next('opponent_left');
    const again = client();
    await again.opened;
    again.send({ type: 'join', roomId: room.roomId, token: room.blackJoin.token });
    const { clock } = await again.next('joined');
    assert.equal(clock.running, 'w');
    assert.ok(clock.b > 60_000 && clock.b <= 65_000, `black ${clock.b}`); // 60s + 5s increment - thinking time
  });

  test('the server ends the game when the side to move runs out of time', async () => {
    const room = await startRoom({ timeControl: { base: 3, increment: 0 } });
    room.white.send({ type: 'move', from: 'e2', to: 'e4', ply: 0 });
    await room.white.next('move');
    const over = await room.white.next('game_over', 5_000); // black never moves
    assert.deepEqual([over.winner, over.reason], ['w', 'timeout']);
    assert.equal(over.clock.running, null);
    assert.equal(over.clock.b, 0);
    room.black.send({ type: 'move', from: 'e7', to: 'e5', ply: 1 });
    assert.equal((await room.black.next('rejected')).reason, 'GAME_OVER');
  });

  test('resigning stops the clock', async () => {
    const room = await startRoom({ timeControl: { base: 60, increment: 0 } });
    room.white.send({ type: 'move', from: 'e2', to: 'e4', ply: 0 });
    await room.white.next('move');
    room.black.send({ type: 'resign' });
    const over = await room.white.next('game_over');
    assert.equal(over.clock.running, null);
  });

  test('a rematch starts a fresh clock with the same time control', async () => {
    const room = await startRoom({ timeControl: { base: 60, increment: 2 } });
    room.white.send({ type: 'move', from: 'e2', to: 'e4', ply: 0 });
    await room.white.next('move');
    room.black.send({ type: 'resign' });
    await room.white.next('game_over');
    room.white.send({ type: 'rematch' });
    room.black.send({ type: 'rematch' });
    const started = await room.white.next('rematch_started');
    assert.deepEqual(started.clock, { w: 60_000, b: 60_000, running: null, baseMs: 60_000, incMs: 2_000 });
  });
});
