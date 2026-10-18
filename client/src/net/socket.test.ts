import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createSocket, type ConnectionStatus } from './socket';

// Minimal controllable WebSocket: tests decide when each event fires.
class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  constructor() {
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 2;
  }
  fireOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
  fireClose() {
    this.readyState = 3;
    this.onclose?.();
  }
}

function connect() {
  const statuses: ConnectionStatus[] = [];
  const onOpen = vi.fn();
  const socket = createSocket({ onStatus: (s) => statuses.push(s), onMessage: vi.fn(), onOpen });
  return { socket, statuses, onOpen, ws: FakeWebSocket.instances[FakeWebSocket.instances.length - 1] };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('window', globalThis);
});
afterEach(() => vi.unstubAllGlobals());

describe('createSocket', () => {
  test('reports open once connected', () => {
    const { statuses, ws, onOpen } = connect();
    ws.fireOpen();
    expect(statuses).toEqual(['connecting', 'open']);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  // React dev mode mounts, unmounts and remounts. The discarded socket's late close event
  // must not overwrite the live socket's "open" status.
  test('a discarded socket closing late does not clobber the live connection', () => {
    const shared: ConnectionStatus[] = [];
    const first = createSocket({ onStatus: (s) => shared.push(s), onMessage: vi.fn(), onOpen: vi.fn() });
    const firstWs = FakeWebSocket.instances[0];
    first.close();
    createSocket({ onStatus: (s) => shared.push(s), onMessage: vi.fn(), onOpen: vi.fn() });
    const secondWs = FakeWebSocket.instances[1];

    secondWs.fireOpen();
    firstWs.fireClose(); // arrives after the new socket opened

    expect(shared[shared.length - 1]).toBe('open');
  });

  test('a discarded socket that still manages to open does not send a join', () => {
    const { socket, ws, onOpen } = connect();
    socket.close();
    ws.fireOpen();
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('an unexpected drop reports reconnecting and retries', () => {
    vi.useFakeTimers();
    const { statuses, ws } = connect();
    ws.fireOpen();
    ws.fireClose();
    expect(statuses[statuses.length - 1]).toBe('reconnecting');
    vi.advanceTimersByTime(600);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.useRealTimers();
  });
});
