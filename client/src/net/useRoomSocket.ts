import { useEffect, useRef, useState } from 'react';
import type { ClockState } from '../game/clock';
import { useGame } from '../game/GameContext';
import type { ClientMessage, ClockSnapshot, ErrorCode } from './protocol';
import { createSocket, loadName, loadToken, saveToken, type Socket } from './socket';

const FATAL: ErrorCode[] = ['ROOM_NOT_FOUND', 'ROOM_FULL'];

// Stamped on arrival so the display can tick locally between server updates. Older servers send no clock.
const stamp = (clock: ClockSnapshot | null | undefined): ClockState | null =>
  clock ? { ...clock, receivedAt: performance.now() } : null;

// Owns the room connection: joins on every (re)connect and turns server messages into dispatches.
export function useRoomSocket(roomId: string) {
  const { dispatch } = useGame();
  const socketRef = useRef<Socket | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);

  useEffect(() => {
    const socket = createSocket({
      onStatus: (connection) => dispatch({ type: 'SET_CONNECTION', connection }),
      onOpen: () => socket.send({ type: 'join', roomId, token: loadToken(roomId), name: loadName() }),
      onMessage: (msg) => {
        switch (msg.type) {
          case 'joined':
            saveToken(msg.roomId, msg.token);
            dispatch({
              type: 'JOINED',
              color: msg.color,
              moves: msg.moves,
              opponentOnline: msg.opponentOnline,
              opponentName: msg.opponentName ?? '', // older servers omit these
              result: msg.result,
              rematch: msg.rematch ?? { mine: false, theirs: false },
            });
            dispatch({ type: 'CLOCK_SYNC', clock: stamp(msg.clock) });
            break;
          case 'opponent_joined':
          case 'opponent_back':
            dispatch({ type: 'OPPONENT_STATUS', online: true });
            dispatch({ type: 'OPPONENT_NAME', name: msg.name ?? '' });
            break;
          case 'opponent_name':
            dispatch({ type: 'OPPONENT_NAME', name: msg.name });
            break;
          case 'rematch_offered':
            dispatch({ type: 'REMATCH_OFFERED' });
            break;
          case 'rematch_started':
            dispatch({ type: 'REMATCH_STARTED', color: msg.color });
            dispatch({ type: 'CLOCK_SYNC', clock: stamp(msg.clock) });
            break;
          case 'opponent_left':
            dispatch({ type: 'OPPONENT_STATUS', online: false });
            break;
          case 'move':
            dispatch({ type: 'SERVER_MOVE', ply: msg.ply, move: { from: msg.from, to: msg.to, promotion: msg.promotion, san: msg.san } });
            if (msg.clock) dispatch({ type: 'CLOCK_SYNC', clock: stamp(msg.clock) });
            break;
          case 'rejected':
            dispatch({ type: 'SERVER_SYNC', moves: msg.moves });
            break;
          case 'game_over':
            dispatch({ type: 'GAME_OVER', result: { winner: msg.winner, reason: msg.reason } });
            if (msg.clock) dispatch({ type: 'CLOCK_SYNC', clock: stamp(msg.clock) });
            break;
          case 'error':
            if (FATAL.includes(msg.code)) {
              setError(msg.code);
              socket.close();
              dispatch({ type: 'SET_CONNECTION', connection: 'closed' });
            }
            break;
          case 'pong':
          case 'created':
            break;
        }
      },
    });
    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId, dispatch]);

  const send = (msg: ClientMessage) => socketRef.current?.send(msg) ?? false;
  return { send, error };
}
