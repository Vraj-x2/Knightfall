import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { GameState } from './gameReducer';
import { playSound, soundKindFor } from './sounds';

// Plays move sounds and reports which ply should slide in. Stays quiet for the history delivered on join.
// `skipSlide` is set when the player dragged the piece, which already landed where they dropped it.
export function useMoveFeedback(state: GameState, skipSlide: MutableRefObject<boolean>): number | null {
  const [animatedPly, setAnimatedPly] = useState<number | null>(null);
  const seen = useRef<{ plies: number; result: GameState['result'] } | null>(null);
  const { moves, result, myColor } = state;

  useEffect(() => {
    if (myColor === null) return;
    const before = seen.current;
    seen.current = { plies: moves.length, result };
    if (!before) return;

    if (moves.length === before.plies + 1) {
      playSound(soundKindFor(moves[moves.length - 1].san));
      setAnimatedPly(skipSlide.current ? null : moves.length);
      skipSlide.current = false;
    } else {
      setAnimatedPly(null);
    }
    if (result && !before.result && result.reason !== 'checkmate') playSound('end');
  }, [moves, result, myColor, skipSlide]);

  return animatedPly;
}
