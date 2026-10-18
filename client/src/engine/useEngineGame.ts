import { useEffect, useState } from 'react';
import { useGame } from '../game/GameContext';
import { findLegalMove, localResult } from '../game/selectors';
import type { Color } from '../net/protocol';
import type { Level } from './levels';
import { createEngine, type Engine } from './stockfish';

const other = (color: Color): Color => (color === 'w' ? 'b' : 'w');

// Runs a game against Stockfish with no server. It feeds the same reducer the online game uses:
// the engine's replies arrive as opponent moves, and game-over is worked out locally.
export function useEngineGame(level: Level, startColor: Color) {
  const { state, dispatch, game } = useGame();
  const [engine, setEngine] = useState<Engine | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seat the player, mark the "opponent" present and the connection open so the board unlocks.
  useEffect(() => {
    dispatch({
      type: 'JOINED',
      color: startColor,
      moves: [],
      opponentOnline: true,
      opponentName: `Stockfish (${level.label})`,
      result: null,
      rematch: { mine: false, theirs: false },
    });
    dispatch({ type: 'SET_CONNECTION', connection: 'open' });
  }, [dispatch, level, startColor]);

  // Load the engine once, off the main thread; shut it down when leaving.
  useEffect(() => {
    let cancelled = false;
    let started: Engine | null = null;
    createEngine()
      .then((e) => {
        if (cancelled) return e.dispose();
        started = e;
        setEngine(e);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'The chess engine failed to start');
      });
    return () => {
      cancelled = true;
      started?.dispose();
    };
  }, []);

  // No server to call the result, so detect it here (mate, stalemate, draws).
  useEffect(() => {
    if (state.result || state.myColor === null) return;
    const result = localResult(game);
    if (result) dispatch({ type: 'GAME_OVER', result });
  }, [game, state.result, state.myColor, dispatch]);

  // The engine's turn. Leaving, resigning or restarting aborts the search, so a late answer is dropped.
  const engineToMove = Boolean(engine) && state.myColor !== null && !state.result && game.turn() !== state.myColor;
  useEffect(() => {
    if (!engine || !engineToMove) return;
    const controller = new AbortController();
    engine
      .bestMove(state.moves, level, controller.signal)
      .then((move) => {
        if (!move || controller.signal.aborted) return;
        const legal = findLegalMove(game, move.from, move.to, move.promotion);
        if (!legal) return setError('The engine returned an illegal move');
        dispatch({
          type: 'SERVER_MOVE',
          ply: state.moves.length,
          move: { from: move.from, to: move.to, promotion: move.promotion, san: legal.san },
        });
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'The chess engine failed');
      });
    return () => controller.abort();
  }, [engine, engineToMove, state.moves, level, game, dispatch]);

  return {
    error,
    resign: () => state.myColor && dispatch({ type: 'GAME_OVER', result: { winner: other(state.myColor), reason: 'resignation' } }),
    // A rematch swaps colours, like the online one.
    rematch: () => state.myColor && dispatch({ type: 'REMATCH_STARTED', color: other(state.myColor) }),
  };
}
