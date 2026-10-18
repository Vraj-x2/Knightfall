import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../game/GameContext';
import { detectEndEvent, detectMoveEvent, type Names } from './events';
import { createLinePicker } from './linePicker';
import { speak } from './speech';

export type CommentLine = { id: number; text: string };
const MAX_LINES = 40;

// Turns each new move (and the game's end) into a commentator line, newest first.
// History delivered on join or reconnect is skipped: commentary is for moves played live.
export function useCommentary(names: Names, voiceOn: boolean): CommentLine[] {
  const { state, game } = useGame();
  const [lines, setLines] = useState<CommentLine[]>([]);
  const pick = useMemo(() => createLinePicker(), []);
  const seen = useRef<{ plies: number; ended: boolean } | null>(null);
  const nextId = useRef(0);
  const live = useRef({ names, voiceOn });
  live.current = { names, voiceOn };
  const { moves, result, myColor } = state;

  useEffect(() => {
    if (myColor === null) return;
    const before = seen.current;
    seen.current = { plies: moves.length, ended: Boolean(result) };
    if (!before) return;

    const said: string[] = [];
    if (moves.length < before.plies) setLines([]); // a rematch started
    if (moves.length === before.plies + 1) {
      const move = game.history({ verbose: true }).at(-1);
      if (move) said.push(pick(detectMoveEvent(game, move, moves.length - 1, live.current.names)));
    }
    if (result && !before.ended) {
      const end = detectEndEvent(result, live.current.names);
      if (end) said.push(pick(end));
    }
    if (said.length === 0) return;

    setLines((prev) => [...said.reverse().map((text) => ({ id: nextId.current++, text })), ...prev].slice(0, MAX_LINES));
    if (live.current.voiceOn) speak(said.join(' '));
  }, [moves, result, myColor, game, pick]);

  return lines;
}
