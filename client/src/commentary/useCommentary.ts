import { useEffect, useMemo, useRef, useState } from 'react';
import type { Move } from 'chess.js';
import { useGame } from '../game/GameContext';
import { detectEndEvent, detectMoveEvent, factsFor, type Names } from './events';
import { createLinePicker } from './linePicker';
import { loadOpenings, openingName } from './openings';
import { findOpeningFact, type OpeningFact } from './wikipedia';

export type CommentLine = { id: number; text: string; source?: { title: string; url: string } };
const MAX_LINES = 40;
const OPENING_PLIES = 30; // past this, a named position is a coincidence, not the opening

const family = (opening: string) => opening.split(':')[0];

// Turns each new move (and the game's end) into commentator lines, newest first, and names the opening
// with a fact from Wikipedia. History delivered on join or reconnect is skipped: commentary is for live moves.
export function useCommentary(names: Names): CommentLine[] {
  const { state, game } = useGame();
  const [lines, setLines] = useState<CommentLine[]>([]);
  const pick = useMemo(() => createLinePicker(), []);
  const seen = useRef<{ plies: number; ended: boolean } | null>(null);
  const nextId = useRef(0);
  const namesRef = useRef(names);
  namesRef.current = names;
  // Per game: the opening family last announced and the articles already quoted. `epoch` drops answers
  // that arrive after a rematch has started.
  const opening = useRef({ epoch: 0, family: '', quoted: new Set<string>() });
  const [book, setBook] = useState<Record<string, string> | null>(null);
  const { moves, result, myColor } = state;

  useEffect(() => {
    loadOpenings()
      .then(setBook)
      .catch(() => undefined); // no opening names, the rest of the commentary still works
  }, []);

  useEffect(() => {
    const add = (entries: Omit<CommentLine, 'id'>[]) =>
      setLines((prev) => [...entries.reverse().map((e) => ({ ...e, id: nextId.current++ })), ...prev].slice(0, MAX_LINES));

    function announceOpening(move: Move, ply: number): Omit<CommentLine, 'id'> | null {
      const name = book && ply < OPENING_PLIES ? openingName(book, game) : null;
      const tracker = opening.current;
      if (!name || family(name) === tracker.family) return null;
      tracker.family = family(name);
      const epoch = tracker.epoch;
      void findOpeningFact(name).then((fact: OpeningFact | null) => {
        if (!fact || opening.current.epoch !== epoch || opening.current.quoted.has(fact.title)) return;
        opening.current.quoted.add(fact.title);
        add([{ text: fact.text, source: { title: fact.title, url: fact.url } }]);
      });
      return { text: pick({ kind: 'openingName', facts: { ...factsFor(move, namesRef.current), opening: name } }) };
    }

    if (myColor === null) return;
    const before = seen.current;
    seen.current = { plies: moves.length, ended: Boolean(result) };
    if (!before) return;

    if (moves.length < before.plies) {
      // A rematch started.
      setLines([]);
      opening.current = { epoch: opening.current.epoch + 1, family: '', quoted: new Set() };
    }
    const said: Omit<CommentLine, 'id'>[] = [];
    if (moves.length === before.plies + 1) {
      const move = game.history({ verbose: true }).at(-1);
      if (move) {
        said.push({ text: pick(detectMoveEvent(game, move, moves.length - 1, namesRef.current)) });
        const named = announceOpening(move, moves.length - 1);
        if (named) said.push(named);
      }
    }
    if (result && !before.ended) {
      const end = detectEndEvent(result, namesRef.current);
      if (end) said.push({ text: pick(end) });
    }
    if (said.length > 0) add(said);
  }, [moves, result, myColor, game, pick, book]);

  return lines;
}
