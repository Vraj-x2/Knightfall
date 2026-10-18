import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { Chess } from 'chess.js';
import type { MoveRecord } from '../net/protocol';
import { gameReducer, initialState, type GameAction, type GameState } from './gameReducer';
import { replay } from './selectors';

type GameContextValue = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  game: Chess; // the live game: used for input and legality
  viewGame: Chess; // what the board shows: the live game, or an earlier position while rewinding
  shownMoves: MoveRecord[];
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ roomId, children }: { roomId: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, roomId, initialState);
  const game = useMemo(() => replay(state.moves), [state.moves]);
  const shownMoves = useMemo(
    () => (state.viewPly === null ? state.moves : state.moves.slice(0, state.viewPly)),
    [state.moves, state.viewPly],
  );
  const viewGame = useMemo(() => (state.viewPly === null ? game : replay(shownMoves)), [game, shownMoves, state.viewPly]);
  const value = useMemo(() => ({ state, dispatch, game, viewGame, shownMoves }), [state, game, viewGame, shownMoves]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
