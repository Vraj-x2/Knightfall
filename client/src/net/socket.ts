import type { ClientMessage, ServerMessage, TimeControl } from './protocol';
import { readItem, writeItem } from '../storage';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

const WS_URL: string = import.meta.env.VITE_WS_URL;
const PING_EVERY_MS = 25_000;
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 5_000;

type Handlers = {
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  onOpen: () => void;
};

export type Socket = { send: (msg: ClientMessage) => boolean; close: () => void };

// Connects, pings every 25s (Cloudflare drops idle sockets at ~100s) and reconnects with backoff.
// After close() the socket is inert: it reports nothing, so a discarded socket's late events
// (React dev double-mount, a handshake that finishes after close) cannot overwrite a newer one's state.
export function createSocket({ onMessage, onStatus, onOpen }: Handlers): Socket {
  let ws: WebSocket | null = null;
  let pingTimer: number | undefined;
  let retryTimer: number | undefined;
  let attempts = 0;
  let stopped = false;

  const rawSend = (msg: ClientMessage) => {
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  };

  function connect() {
    const socket = new WebSocket(WS_URL);
    ws = socket;
    socket.onopen = () => {
      if (stopped) return socket.close();
      attempts = 0;
      onStatus('open');
      window.clearInterval(pingTimer);
      pingTimer = window.setInterval(() => rawSend({ type: 'ping' }), PING_EVERY_MS);
      onOpen();
    };
    socket.onmessage = (event) => {
      if (stopped) return;
      try {
        onMessage(JSON.parse(event.data as string) as ServerMessage);
      } catch {
        // Ignore malformed frames; the server only sends JSON.
      }
    };
    socket.onclose = () => {
      window.clearInterval(pingTimer);
      if (stopped) return;
      onStatus('reconnecting');
      const delay = Math.min(RETRY_BASE_MS * 2 ** attempts++, RETRY_MAX_MS);
      retryTimer = window.setTimeout(connect, delay);
    };
  }

  onStatus('connecting');
  connect();

  return {
    send: rawSend,
    close: () => {
      stopped = true;
      window.clearInterval(pingTimer);
      window.clearTimeout(retryTimer);
      ws?.close();
    },
  };
}

// One-shot helper for the lobby: opens a socket, creates a room, resolves with its id.
export function createRoom(timeControl?: TimeControl): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'create', timeControl } satisfies ClientMessage));
    ws.onerror = () => reject(new Error('Could not reach the game server'));
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      if (msg.type === 'created') {
        saveToken(msg.roomId, msg.token);
        ws.close();
        resolve(msg.roomId);
      } else if (msg.type === 'error') {
        ws.close();
        reject(new Error(`Server refused: ${msg.code}`));
      }
    };
  });
}

const tokenKey = (roomId: string) => `chess-token:${roomId}`;

export const loadToken = (roomId: string): string | undefined => readItem(tokenKey(roomId)) ?? undefined;
// If storage is blocked, a refresh loses the seat; play still works.
export const saveToken = (roomId: string, token: string) => writeItem(tokenKey(roomId), token);

const NAME_KEY = 'chess-name';
export const MAX_NAME_LENGTH = 20;

export const loadName = (): string => readItem(NAME_KEY) ?? '';
export const saveName = (name: string) => writeItem(NAME_KEY, name);
