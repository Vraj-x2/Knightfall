import type { Level } from './levels';
import { goCommand, parseBestMove, positionCommand, type EngineMove } from './uci';

// Served from public/engine (copied from node_modules by scripts/copy-engine.mjs). The loader finds
// its .wasm by swapping this file's extension, so the two files must share a name.
const ENGINE_URL = '/engine/stockfish-lite-single.js';
const START_TIMEOUT_MS = 15_000;

// The slice of the Worker API we use, so tests can drive a fake.
export type EngineWorker = {
  postMessage: (message: string) => void;
  terminate: () => void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
};

export type Engine = {
  // Resolves with the engine's move, or null if it has none or the search was cancelled.
  bestMove: (moves: { from: string; to: string; promotion?: string }[], level: Level, signal?: AbortSignal) => Promise<EngineMove | null>;
  dispose: () => void;
};

type Waiter = { matches: (line: string) => boolean; resolve: (line: string) => void; reject: (error: Error) => void };

const defaultWorker = (): EngineWorker => new Worker(ENGINE_URL) as unknown as EngineWorker;

// Starts the engine in a Web Worker so thinking never blocks the page, and completes the UCI handshake.
export async function createEngine(makeWorker: () => EngineWorker = defaultWorker, startTimeoutMs = START_TIMEOUT_MS): Promise<Engine> {
  const worker = makeWorker();
  let waiters: Waiter[] = [];
  let failure: Error | null = null;

  const fail = (error: Error) => {
    failure ??= error;
    const pending = waiters;
    waiters = [];
    pending.forEach((w) => w.reject(error));
  };

  worker.onmessage = ({ data }) => {
    if (typeof data !== 'string') return;
    for (const line of data.split('\n')) {
      const index = waiters.findIndex((w) => w.matches(line));
      if (index >= 0) waiters.splice(index, 1)[0].resolve(line);
    }
  };
  worker.onerror = () => fail(new Error('The chess engine could not be loaded'));

  const waitFor = (matches: (line: string) => boolean) =>
    new Promise<string>((resolve, reject) => {
      if (failure) return reject(failure);
      waiters.push({ matches, resolve, reject });
    });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('The chess engine did not start')), startTimeoutMs);
  });

  try {
    worker.postMessage('uci');
    await Promise.race([waitFor((l) => l.trim() === 'uciok'), timeout]);
    worker.postMessage('isready');
    await Promise.race([waitFor((l) => l.trim() === 'readyok'), timeout]);
  } catch (error) {
    worker.terminate();
    throw error;
  } finally {
    clearTimeout(timer);
  }

  // Searches run strictly one at a time: the protocol has a single "current search" slot.
  let queue: Promise<unknown> = Promise.resolve();

  const search = async (moves: { from: string; to: string; promotion?: string }[], level: Level, signal?: AbortSignal): Promise<EngineMove | null> => {
    if (signal?.aborted) return null;
    worker.postMessage(`setoption name Skill Level value ${level.skill}`);
    worker.postMessage(positionCommand(moves));
    const answer = waitFor((l) => parseBestMove(l) !== null);
    const stop = () => worker.postMessage('stop');
    signal?.addEventListener('abort', stop, { once: true });
    worker.postMessage(goCommand(level.movetimeMs));
    try {
      const line = await answer;
      // After "stop" the engine still sends a bestmove; consuming it keeps the next search in sync.
      return signal?.aborted ? null : (parseBestMove(line)?.move ?? null);
    } finally {
      signal?.removeEventListener('abort', stop);
    }
  };

  return {
    bestMove(moves, level, signal) {
      if (failure) return Promise.reject(failure);
      const result = queue.then(() => search(moves, level, signal));
      queue = result.catch(() => undefined);
      return result;
    },
    dispose() {
      fail(new Error('The chess engine was shut down'));
      worker.terminate();
    },
  };
}
