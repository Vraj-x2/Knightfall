import { WebSocketServer } from 'ws';
import { expiredSide, msUntilFlag, parseTimeControl, snapshot, stop } from './clock.js';
import { createRoomStore, other, sanitizeName } from './rooms.js';

const PORT = Number(process.env.PORT) || 8090;
// HOST and EXTRA_ORIGINS exist only for LAN testing on a laptop; production keeps the defaults.
const HOST = process.env.HOST || '127.0.0.1';
const ALLOWED_ORIGINS = new Set([
  'https://chess.vrajcloud.dev',
  'http://localhost:5173',
  ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',') : []),
]);
const MAX_MESSAGE_BYTES = 1024;
const MAX_MESSAGES_PER_SECOND = 20;
const PING_TIMEOUT_MS = 60_000;
const HEARTBEAT_CHECK_MS = 10_000;
const SWEEP_EVERY_MS = 5 * 60 * 1000;
const SQUARE = /^[a-h][1-8]$/;

const store = createRoomStore();
const wss = new WebSocketServer({
  host: HOST,
  port: PORT,
  maxPayload: 4 * MAX_MESSAGE_BYTES,
  verifyClient: ({ origin }) => ALLOWED_ORIGINS.has(origin),
});

const send = (ws, type, payload = {}) => {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type, ...payload }));
};
const sendError = (ws, code) => send(ws, 'error', { code });
const sockets = (room) => Object.values(room.seats).map((s) => s?.socket);
const broadcast = (room, type, payload) => sockets(room).forEach((s) => send(s, type, payload));
const tell = (room, color, type, payload) => send(room.seats[color]?.socket, type, payload);

function handleCreate(ws, msg) {
  if (ws.room) return sendError(ws, 'BAD_MESSAGE');
  const control = msg.timeControl === undefined ? null : parseTimeControl(msg.timeControl);
  if (msg.timeControl !== undefined && !control) return sendError(ws, 'BAD_MESSAGE');
  const room = store.create(control);
  if (!room) return sendError(ws, 'RATE_LIMIT');
  seat(ws, room, 'w');
  send(ws, 'created', { roomId: room.id, color: 'w', token: room.seats.w.token });
}

function seat(ws, room, color) {
  const current = room.seats[color].socket;
  if (current && current !== ws) {
    current.room = null;
    current.close(4000, 'replaced');
  }
  room.seats[color].socket = ws;
  ws.room = room;
  ws.color = color;
  room.lastActive = Date.now();
}

function handleJoin(ws, msg) {
  if (ws.room || typeof msg.roomId !== 'string') return sendError(ws, 'BAD_MESSAGE');
  const room = store.get(msg.roomId);
  if (!room) return sendError(ws, 'ROOM_NOT_FOUND');
  const token = typeof msg.token === 'string' ? msg.token : undefined;
  const claim = store.claimSeat(room, token);
  if (!claim) return sendError(ws, 'ROOM_FULL');
  seat(ws, room, claim.color);
  const name = typeof msg.name === 'string' ? sanitizeName(msg.name) : '';
  if (name) claim.seat.name = name; // a blank join keeps the name already on the seat
  const opponent = room.seats[other(claim.color)];
  send(ws, 'joined', {
    roomId: room.id,
    color: claim.color,
    token: claim.seat.token,
    moves: room.moves,
    opponentOnline: Boolean(opponent?.socket),
    opponentName: opponent?.name ?? '',
    clock: clockOf(room),
    result: room.result,
    rematch: { mine: claim.seat.wantsRematch, theirs: Boolean(opponent?.wantsRematch) },
  });
  tell(room, other(claim.color), claim.isNew ? 'opponent_joined' : 'opponent_back', { name: claim.seat.name });
}

function handleSetName(ws, msg) {
  if (!ws.room || typeof msg.name !== 'string') return sendError(ws, 'BAD_MESSAGE');
  const name = sanitizeName(msg.name);
  ws.room.seats[ws.color].name = name;
  ws.room.lastActive = Date.now();
  tell(ws.room, other(ws.color), 'opponent_name', { name });
}

function handleRematch(ws) {
  const room = ws.room;
  if (!room) return sendError(ws, 'BAD_MESSAGE');
  room.lastActive = Date.now();
  const outcome = store.requestRematch(room, ws.color);
  if (outcome === 'offered') return tell(room, other(ws.color), 'rematch_offered');
  if (outcome !== 'started') return;
  for (const color of ['w', 'b']) {
    const { socket } = room.seats[color];
    if (socket) socket.color = color;
    send(socket, 'rematch_started', { color, clock: clockOf(room) });
  }
}

function handleMove(ws, msg) {
  const room = ws.room;
  const { from, to, promotion, ply } = msg;
  const valid =
    room &&
    SQUARE.test(from) &&
    SQUARE.test(to) &&
    Number.isInteger(ply) &&
    (promotion === undefined || 'qrbn'.includes(promotion)) &&
    (promotion === undefined || promotion.length === 1);
  if (!valid) return sendError(ws, 'BAD_MESSAGE');
  room.lastActive = Date.now();
  const outcome = store.applyMove(room, ws.color, { from, to, promotion, ply });
  if (outcome.flagged) return endGame(room, store.timeoutResult(room, ws.color));
  if (outcome.reason) return send(ws, 'rejected', { reason: outcome.reason, moves: room.moves });
  broadcast(room, 'move', { ...outcome.move, ply, clock: clockOf(room) });
  const result = store.gameResult(room, ws.color);
  if (result) endGame(room, result);
  else armFlagTimer(room);
}

// Snapshot for clients, or null for an untimed game.
const clockOf = (room) => (room.clock ? snapshot(room.clock, Date.now()) : null);

function endGame(room, result) {
  clearTimeout(room.flagTimer);
  room.flagTimer = null;
  if (room.clock) room.clock = stop(room.clock, Date.now());
  room.result = result;
  const clock = clockOf(room);
  broadcast(room, 'game_over', clock ? { ...result, clock } : result);
}

// The server, not the clients, decides when time is up: one timer per room, re-armed after every move.
function armFlagTimer(room) {
  clearTimeout(room.flagTimer);
  room.flagTimer = null;
  const ms = room.clock && !room.result ? msUntilFlag(room.clock, Date.now()) : null;
  if (ms === null) return;
  room.flagTimer = setTimeout(() => {
    const side = room.result || !room.clock ? null : expiredSide(room.clock, Date.now());
    if (side) endGame(room, store.timeoutResult(room, side));
    else armFlagTimer(room); // woke a hair early
  }, Math.max(0, ms) + 2);
}

function handleResign(ws) {
  const room = ws.room;
  if (!room) return sendError(ws, 'BAD_MESSAGE');
  if (room.result) return;
  room.lastActive = Date.now();
  endGame(room, { winner: other(ws.color), reason: 'resignation' });
}

function onMessage(ws, data, isBinary) {
  if (isBinary || data.length > MAX_MESSAGE_BYTES) return;
  const now = Date.now();
  if (now - ws.windowStart >= 1000) {
    ws.windowStart = now;
    ws.windowCount = 0;
  }
  if (++ws.windowCount > MAX_MESSAGES_PER_SECOND) return sendError(ws, 'RATE_LIMIT');

  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch {
    return sendError(ws, 'BAD_MESSAGE');
  }
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return sendError(ws, 'BAD_MESSAGE');

  switch (msg.type) {
    case 'ping':
      ws.lastPing = now;
      return send(ws, 'pong');
    case 'create':
      return handleCreate(ws, msg);
    case 'join':
      return handleJoin(ws, msg);
    case 'move':
      return handleMove(ws, msg);
    case 'resign':
      return handleResign(ws);
    case 'set_name':
      return handleSetName(ws, msg);
    case 'rematch':
      return handleRematch(ws);
    default:
      return sendError(ws, 'BAD_MESSAGE');
  }
}

function onClose(ws) {
  const room = ws.room;
  if (!room) return;
  room.lastActive = Date.now();
  if (room.seats[ws.color].socket === ws) {
    room.seats[ws.color].socket = null;
    tell(room, other(ws.color), 'opponent_left');
  }
}

wss.on('connection', (ws) => {
  ws.room = null;
  ws.color = null;
  ws.lastPing = Date.now();
  ws.windowStart = ws.lastPing;
  ws.windowCount = 0;
  ws.on('message', (data, isBinary) => onMessage(ws, data, isBinary));
  ws.on('close', () => onClose(ws));
  ws.on('error', () => ws.terminate());
});

setInterval(() => {
  const now = Date.now();
  for (const ws of wss.clients) if (now - ws.lastPing > PING_TIMEOUT_MS) ws.terminate();
}, HEARTBEAT_CHECK_MS).unref();
setInterval(() => store.sweep(), SWEEP_EVERY_MS).unref();

console.log(`chess server listening on ${HOST}:${PORT}`);
