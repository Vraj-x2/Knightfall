import { useEffect, useRef, useState } from 'react';
import { detectMoveEvent } from '../commentary/events';
import { useGame } from '../game/GameContext';
import { findReaction, reactionsEnabled, type Moment, type Reaction } from './giphy';

const SHOW_MS = 3_500;
const COOLDOWN_PLIES = 4; // a GIF is a treat for big moments, not every capture

const MOMENTS: Partial<Record<string, Moment>> = {
  hangingPiece: 'blunder',
  queenTaken: 'queen',
  checkmate: 'checkmate',
  promotion: 'promotion',
};

// Watches live moves and briefly returns a reaction GIF for the big moments.
export function useReaction(): Reaction | null {
  const { state, game } = useGame();
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const seen = useRef<number | null>(null);
  const lastPly = useRef(-COOLDOWN_PLIES);
  // Bumped on rematch and unmount. A GIF still loading when the next move lands should still show,
  // so only a new game (or leaving) drops it.
  const epoch = useRef(0);
  const { moves, myColor } = state;

  useEffect(() => {
    if (myColor === null || !reactionsEnabled()) return;
    const before = seen.current;
    seen.current = moves.length;
    if (before === null) return; // history delivered on join: no reactions
    if (moves.length < before) {
      // A rematch started.
      lastPly.current = -COOLDOWN_PLIES;
      epoch.current++;
      setReaction(null);
    }
    if (moves.length !== before + 1) return;

    const ply = moves.length - 1;
    const move = game.history({ verbose: true }).at(-1);
    const moment = move && MOMENTS[detectMoveEvent(game, move, ply, { w: '', b: '' }).kind];
    if (!moment || (moment !== 'checkmate' && ply - lastPly.current < COOLDOWN_PLIES)) return;
    lastPly.current = ply;

    const started = epoch.current;
    const current = () => epoch.current === started;
    void findReaction(moment).then((found) => {
      if (!found || !current()) return;
      // Show it only once loaded, so it doesn't pop in half-drawn.
      const img = new Image();
      img.onload = () => current() && setReaction(found);
      img.src = found.url;
    });
  }, [moves, myColor, game]);

  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );

  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setReaction(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [reaction]);

  return reaction;
}
