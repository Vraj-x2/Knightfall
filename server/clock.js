// Pure chess-clock functions: every call returns a new clock and takes `now` explicitly, so the
// rules are testable without timers. The server is the only authority on time.
//
// Rules: nothing runs until white has made the first move (it is free). After that the side to
// move is charged for its thinking time and gets `incMs` back when it completes a move.

export const MIN_BASE_SECONDS = 3;
export const MAX_BASE_SECONDS = 3 * 60 * 60;
export const MAX_INCREMENT_SECONDS = 60;

const other = (color) => (color === 'w' ? 'b' : 'w');

// Validates untrusted input; returns { baseMs, incMs } or null.
export function parseTimeControl(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { base, increment } = raw;
  if (!Number.isInteger(base) || !Number.isInteger(increment)) return null;
  if (base < MIN_BASE_SECONDS || base > MAX_BASE_SECONDS) return null;
  if (increment < 0 || increment > MAX_INCREMENT_SECONDS) return null;
  return { baseMs: base * 1000, incMs: increment * 1000 };
}

export function newClock({ baseMs, incMs }) {
  return { baseMs, incMs, remaining: { w: baseMs, b: baseMs }, running: null, since: 0 };
}

const left = (clock, color, now) =>
  clock.running === color ? Math.max(0, clock.remaining[color] - (now - clock.since)) : clock.remaining[color];

// What clients render: remaining time per side as of `now`.
export function snapshot(clock, now) {
  return { w: left(clock, 'w', now), b: left(clock, 'b', now), running: clock.running, baseMs: clock.baseMs, incMs: clock.incMs };
}

// `mover` just played; `plyBefore` is how many moves had been played. Returns { clock, flagged }.
export function afterMove(clock, mover, plyBefore, now) {
  if (plyBefore === 0) return { clock: { ...clock, running: other(mover), since: now }, flagged: false };
  const remaining = clock.remaining[mover] - (now - clock.since);
  if (remaining <= 0) {
    return { clock: { ...clock, remaining: { ...clock.remaining, [mover]: 0 }, running: null }, flagged: true };
  }
  return {
    clock: { ...clock, remaining: { ...clock.remaining, [mover]: remaining + clock.incMs }, running: other(mover), since: now },
    flagged: false,
  };
}

// Freezes the clock (game over), charging the side that was running.
export function stop(clock, now) {
  if (!clock.running) return clock;
  return { ...clock, remaining: { ...clock.remaining, [clock.running]: left(clock, clock.running, now) }, running: null };
}

export function msUntilFlag(clock, now) {
  return clock.running ? clock.remaining[clock.running] - (now - clock.since) : null;
}

export function expiredSide(clock, now) {
  const ms = msUntilFlag(clock, now);
  return ms !== null && ms <= 0 ? clock.running : null;
}
