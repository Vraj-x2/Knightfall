import type { Color, GameResult, MoveRecord, RematchState } from '../net/protocol';
import type { ConnectionStatus } from '../net/socket';
import type { ClockState } from './clock';

export type GameState = {
  roomId: string;
  myColor: Color | null;
  moves: MoveRecord[];
  selected: string | null;
  pendingPromotion: { from: string; to: string } | null;
  viewPly: number | null; // null = live; otherwise the position after this many plies
  connection: ConnectionStatus;
  opponentOnline: boolean;
  opponentName: string;
  result: GameResult | null;
  rematch: RematchState;
  clock: ClockState | null; // null for an untimed game
};

export type GameAction =
  | {
      type: 'JOINED';
      color: Color;
      moves: MoveRecord[];
      opponentOnline: boolean;
      opponentName: string;
      result: GameResult | null;
      rematch: RematchState;
    }
  | { type: 'SELECT'; square: string }
  | { type: 'DESELECT' }
  | { type: 'LOCAL_MOVE'; move: MoveRecord }
  | { type: 'SERVER_MOVE'; move: MoveRecord; ply: number }
  | { type: 'SERVER_SYNC'; moves: MoveRecord[] }
  | { type: 'START_PROMOTION'; from: string; to: string }
  | { type: 'CANCEL_PROMOTION' }
  | { type: 'VIEW_PLY'; ply: number | null }
  | { type: 'SET_CONNECTION'; connection: ConnectionStatus }
  | { type: 'OPPONENT_STATUS'; online: boolean }
  | { type: 'GAME_OVER'; result: GameResult }
  | { type: 'CLOCK_SYNC'; clock: ClockState | null }
  | { type: 'OPPONENT_NAME'; name: string }
  | { type: 'REMATCH_REQUESTED' }
  | { type: 'REMATCH_OFFERED' }
  | { type: 'REMATCH_STARTED'; color: Color };

export const initialState = (roomId: string): GameState => ({
  roomId,
  myColor: null,
  moves: [],
  selected: null,
  pendingPromotion: null,
  viewPly: null,
  connection: 'connecting',
  opponentOnline: false,
  opponentName: '',
  result: null,
  rematch: { mine: false, theirs: false },
  clock: null,
});

const sameMove = (a: MoveRecord, b: MoveRecord) =>
  a.from === b.from && a.to === b.to && a.promotion === b.promotion;

// Any change to the move list invalidates a half-made move.
const withMoves = (state: GameState, moves: MoveRecord[]): GameState => ({
  ...state,
  moves,
  selected: null,
  pendingPromotion: null,
});

const live = (state: GameState): GameState => ({ ...state, viewPly: null });

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'JOINED':
      return {
        ...live(withMoves(state, action.moves)),
        myColor: action.color,
        opponentOnline: action.opponentOnline,
        opponentName: action.opponentName,
        result: action.result,
        rematch: action.rematch,
      };
    case 'SELECT':
      return { ...state, selected: action.square };
    case 'DESELECT':
      return { ...state, selected: null };
    case 'LOCAL_MOVE':
      return withMoves(state, [...state.moves, action.move]);
    case 'SERVER_MOVE': {
      const { move, ply } = action;
      if (ply > state.moves.length) return state; // gap: wait for a sync
      if (state.moves[ply] && sameMove(state.moves[ply], move)) return state; // echo of our optimistic move
      return withMoves(state, [...state.moves.slice(0, ply), move]);
    }
    case 'SERVER_SYNC':
      return live(withMoves(state, action.moves));
    case 'VIEW_PLY': {
      const { ply } = action;
      const viewPly = ply === null || ply >= state.moves.length ? null : Math.max(0, ply);
      return { ...state, viewPly, selected: null, pendingPromotion: null };
    }
    case 'START_PROMOTION':
      return { ...state, pendingPromotion: { from: action.from, to: action.to } };
    case 'CANCEL_PROMOTION':
      return { ...state, pendingPromotion: null, selected: null };
    case 'SET_CONNECTION':
      return { ...state, connection: action.connection };
    case 'OPPONENT_STATUS':
      return { ...state, opponentOnline: action.online };
    case 'GAME_OVER':
      return {
        ...state,
        result: action.result,
        selected: null,
        pendingPromotion: null,
        clock: state.clock && { ...state.clock, running: null },
      };
    case 'CLOCK_SYNC':
      return { ...state, clock: action.clock };
    case 'OPPONENT_NAME':
      return { ...state, opponentName: action.name };
    case 'REMATCH_REQUESTED':
      return { ...state, rematch: { ...state.rematch, mine: true } };
    case 'REMATCH_OFFERED':
      return { ...state, rematch: { ...state.rematch, theirs: true } };
    case 'REMATCH_STARTED':
      return {
        ...live(withMoves(state, [])),
        myColor: action.color,
        result: null,
        rematch: { mine: false, theirs: false },
        clock: null,
      };
  }
}
