import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createEngine, type EngineWorker } from './stockfish';
import type { Level } from './levels';

const LEVEL: Level = { id: 'casual', label: 'Casual', skill: 5, movetimeMs: 300 };

// A worker the test drives by hand: `say` plays an engine output line, `sent` records commands.
class FakeWorker implements EngineWorker {
  sent: string[] = [];
  terminated = false;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  postMessage(msg: string) {
    this.sent.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
  say(line: string) {
    this.onmessage?.({ data: line });
  }
  fail(error: unknown) {
    this.onerror?.(error);
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function ready() {
  const worker = new FakeWorker();
  const promise = createEngine(() => worker);
  worker.say('uciok');
  await flush();
  worker.say('readyok');
  return { worker, engine: await promise };
}

describe('createEngine', () => {
  test('performs the UCI handshake before resolving', async () => {
    const worker = new FakeWorker();
    const promise = createEngine(() => worker);
    expect(worker.sent).toEqual(['uci']);
    worker.say('uciok');
    await flush();
    expect(worker.sent).toEqual(['uci', 'isready']);
    worker.say('readyok');
    await expect(promise).resolves.toBeDefined();
  });

  test('rejects, and stops the worker, if the engine never answers', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const promise = createEngine(() => worker, 1000);
    const assertion = expect(promise).rejects.toThrow(/did not start/i);
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    expect(worker.terminated).toBe(true);
    vi.useRealTimers();
  });

  test('rejects when the worker fails to load', async () => {
    const worker = new FakeWorker();
    const promise = createEngine(() => worker);
    worker.fail(new Error('404'));
    await expect(promise).rejects.toThrow(/could not be loaded/i);
  });
});

describe('bestMove', () => {
  test('configures strength, sets the position, searches, and returns the move', async () => {
    const { worker, engine } = await ready();
    worker.sent.length = 0;
    const search = engine.bestMove([{ from: 'e2', to: 'e4' }], LEVEL);
    await flush();
    expect(worker.sent).toEqual([
      'setoption name Skill Level value 5',
      'position startpos moves e2e4',
      'go movetime 300',
    ]);
    worker.say('info depth 8 score cp 20 pv e7e5');
    worker.say('bestmove e7e5 ponder g1f3');
    await expect(search).resolves.toEqual({ from: 'e7', to: 'e5' });
  });

  test('searches run one at a time, in order', async () => {
    const { worker, engine } = await ready();
    worker.sent.length = 0;
    const first = engine.bestMove([], LEVEL);
    const second = engine.bestMove([{ from: 'e2', to: 'e4' }], LEVEL);
    await flush();
    expect(worker.sent.filter((m) => m.startsWith('go'))).toHaveLength(1);
    worker.say('bestmove e2e4');
    await expect(first).resolves.toEqual({ from: 'e2', to: 'e4' });
    await flush();
    expect(worker.sent.filter((m) => m.startsWith('go'))).toHaveLength(2);
    worker.say('bestmove e7e5');
    await expect(second).resolves.toEqual({ from: 'e7', to: 'e5' });
  });

  test('a search cancelled before it starts never reaches the engine', async () => {
    const { worker, engine } = await ready();
    worker.sent.length = 0;
    const controller = new AbortController();
    controller.abort();
    await expect(engine.bestMove([], LEVEL, controller.signal)).resolves.toBeNull();
    expect(worker.sent).toEqual([]);
  });

  test('cancelling a running search stops the engine and returns null', async () => {
    const { worker, engine } = await ready();
    const controller = new AbortController();
    const search = engine.bestMove([], LEVEL, controller.signal);
    await flush();
    controller.abort();
    expect(worker.sent).toContain('stop');
    worker.say('bestmove e2e4'); // the engine still answers after "stop"
    await expect(search).resolves.toBeNull();
  });

  test('"(none)" resolves to null', async () => {
    const { worker, engine } = await ready();
    const search = engine.bestMove([], LEVEL);
    await flush();
    worker.say('bestmove (none)');
    await expect(search).resolves.toBeNull();
  });

  test('a worker crash rejects the search in progress and any later one', async () => {
    const { worker, engine } = await ready();
    const running = engine.bestMove([], LEVEL);
    worker.fail(new Error('boom'));
    await expect(running).rejects.toThrow();
    await expect(engine.bestMove([], LEVEL)).rejects.toThrow();
  });

  test('dispose terminates the worker', async () => {
    const { worker, engine } = await ready();
    engine.dispose();
    expect(worker.terminated).toBe(true);
    await expect(engine.bestMove([], LEVEL)).rejects.toThrow();
  });
});

beforeEach(() => vi.useRealTimers());
afterEach(() => vi.useRealTimers());
