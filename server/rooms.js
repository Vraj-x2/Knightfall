import { Chess } from 'chess.js';
import { nanoid } from 'nanoid';
import { afterMove, newClock } from './clock.js';

export const MAX_ROOMS = 200;
export const ROOM_IDLE_MS = 30 * 60 * 1000;
export const MAX_NAME_LENGTH = 20;

const other = (color) => (color === 'w' ? 'b' : 'w');

const newSeat = () => ({ token: nanoid(21), socket: null, name: '', wantsRematch: false });

// Names are shown to the opponent, so drop control and invisible formatting characters (bidi overrides, zero-width).
export function sanitizeName(raw) {
  return raw.replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, MAX_NAME_LENGTH);
}

// A side can only win on time if the other side could in principle checkmate (approximation:
// any pawn, rook or queen, or two minor pieces). Otherwise a flag fall is a draw.
export function hasMatingMaterial(game, color) {
  let minors = 0;
  for (const row of game.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== color) continue;
      if (cell.type === 'p' || cell.type === 'r' || cell.type === 'q') return true;
      if (cell.type === 'n' || cell.type === 'b') minors++;
    }
  }
  return minors >= 2;
}

export function createRoomStore() {
  const rooms = new Map();

  // `control` is a parsed { baseMs, incMs } or null for an untimed game.
  function create(control = null) {
    if (rooms.size >= MAX_ROOMS) return null;
    const room = {
      id: nanoid(8),
      game: new Chess(),
      moves: [],
      seats: { w: newSeat(), b: null },
      result: null,
      control,
      clock: control ? newClock(control) : null,
      flagTimer: null,
      lastActive: Date.now(),
    };
    rooms.set(room.id, room);
    return room;
  }

  // Returns { color, seat, isNew } or null when the room is full.
  function claimSeat(room, token) {
    for (const color of ['w', 'b']) {
      if (token && room.seats[color]?.token === token) {
        return { color, seat: room.seats[color], isNew: false };
      }
    }
    if (!room.seats.b) {
      room.seats.b = newSeat();
      return { color: 'b', seat: room.seats.b, isNew: true };
    }
    return null;
  }

  // Returns { move } on success, { flagged: true } if the mover's time had already run out,
  // or { reason } when the move must be rejected.
  function applyMove(room, color, { from, to, promotion, ply }, now = Date.now()) {
    if (room.result) return { reason: 'GAME_OVER' };
    if (!room.seats[other(color)]?.socket) return { reason: 'NO_OPPONENT' };
    if (room.game.turn() !== color) return { reason: 'NOT_YOUR_TURN' };
    if (ply !== room.moves.length) return { reason: 'STALE_PLY' };
    const timed = room.clock ? afterMove(room.clock, color, ply, now) : null;
    if (timed?.flagged) {
      room.clock = timed.clock;
      return { flagged: true };
    }
    let played;
    try {
      played = room.game.move({ from, to, promotion });
    } catch {
      return { reason: 'ILLEGAL_MOVE' };
    }
    const move = { from: played.from, to: played.to, san: played.san };
    if (played.promotion) move.promotion = played.promotion;
    room.moves.push(move);
    if (timed) room.clock = timed.clock;
    return { move, ply };
  }

  // Outcome when `loser` runs out of time.
  function timeoutResult(room, loser) {
    const winner = other(loser);
    return hasMatingMaterial(room.game, winner)
      ? { winner, reason: 'timeout' }
      : { winner: null, reason: 'timeout vs insufficient material' };
  }

  function gameResult(room, mover) {
    const g = room.game;
    if (g.isCheckmate()) return { winner: mover, reason: 'checkmate' };
    if (g.isStalemate()) return { winner: null, reason: 'stalemate' };
    if (g.isInsufficientMaterial()) return { winner: null, reason: 'insufficient material' };
    if (g.isThreefoldRepetition()) return { winner: null, reason: 'threefold repetition' };
    if (g.isDraw()) return { winner: null, reason: '50-move rule' };
    return null;
  }

  // Returns 'ignored', 'offered', or 'started' once both players want another game.
  // Starting swaps the seats (tokens and names travel with the player), so colours alternate.
  function requestRematch(room, color) {
    if (!room.result || !room.seats.w || !room.seats.b) return 'ignored';
    room.seats[color].wantsRematch = true;
    if (!room.seats.w.wantsRematch || !room.seats.b.wantsRematch) return 'offered';
    room.game = new Chess();
    room.moves = [];
    room.result = null;
    room.clock = room.control ? newClock(room.control) : null;
    room.seats = { w: room.seats.b, b: room.seats.w };
    room.seats.w.wantsRematch = false;
    room.seats.b.wantsRematch = false;
    return 'started';
  }

  const hasPlayers = (room) => Object.values(room.seats).some((s) => s?.socket);

  function sweep(now = Date.now()) {
    for (const [id, room] of rooms) {
      if (!hasPlayers(room) && now - room.lastActive >= ROOM_IDLE_MS) {
        clearTimeout(room.flagTimer);
        rooms.delete(id);
      }
    }
  }

  return { create, get: (id) => rooms.get(id), claimSeat, applyMove, timeoutResult, gameResult, requestRematch, sweep, size: () => rooms.size };
}

export { other };
