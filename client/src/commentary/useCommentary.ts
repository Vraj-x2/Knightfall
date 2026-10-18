import { useEffect, useMemo, useRef, useState } from 'react';
import type { Move } from 'chess.js';
import { useGame } from '../game/GameContext';
import { detectEndEvent, detectMoveEvent, factsFor, type Names } from './events';
import { createLinePicker } from './linePicker';
import { loadOpenings, openingName } from './openings';
import { adviceSlip, dadJoke, kanyeQuote } from '../extras/funApis';
import { findOpeningFact, type OpeningFact } from './wikipedia';

import type { Color } from '../net/protocol';
import type { LineKind } from './lineStyle';

export type CommentLine = {
  id: number;
  kind: LineKind;
  text: string;
  tag?: string;
  move?: { number: number; san: string; color: Color };
  source?: { title: string; url: string };
};
type Pending = Omit<CommentLine, 'id'>;
const MAX_LINES = 40;
const OPENING_PLIES = 30; // past this, a named position is a coincidence, not the opening
const BIT_COOLDOWN_PLIES = 6; // at most one joke or piece of advice this often, so the feed stays about the game

const family = (opening: string) => opening.split(':')[0];
// "the Sicilian Defense", but "Petrov's Defense" and "Ruy Lopez" read better bare.
const withArticle = (opening: string) => (/^[A-Z][a-z]+ [A-Z]/.test(opening) && !opening.includes("'s ") && !/^Ruy Lopez/.test(opening) ? `the ${opening}` : opening);

// Turns each new move (and the game's end) into commentator lines, newest first, and names the opening
// with a fact from Wikipedia. History delivered on join or reconnect is skipped: commentary is for live moves.
export function useCommentary(names: Names): { lines: CommentLine[]; opening: string | null } {
  const { state, game } = useGame();
  const [lines, setLines] = useState<CommentLine[]>([]);
  const [currentOpening, setCurrentOpening] = useState<string | null>(null);
  const pick = useMemo(() => createLinePicker(), []);
  const seen = useRef<{ plies: number; ended: boolean } | null>(null);
  const nextId = useRef(0);
  const namesRef = useRef(names);
  useEffect(() => {
    namesRef.current = names; // read by the effect below, which shouldn't re-run on a rename
  });
  // Per game: the opening family last announced and the articles already quoted. `epoch` drops answers
  // that arrive after a rematch has started.
  const opening = useRef({ epoch: 0, family: '', quoted: new Set<string>() });
  const lastBitPly = useRef(-BIT_COOLDOWN_PLIES);
  const [book, setBook] = useState<Record<string, string> | null>(null);
  const { moves, result, myColor } = state;

  useEffect(() => {
    loadOpenings()
      .then(setBook)
      .catch(() => undefined); // no opening names, the rest of the commentary still works
  }, []);

  useEffect(() => {
    const add = (entries: Pending[]) => {
      // Ids are assigned outside the updater: React may run an updater twice, which must not change the result.
      const numbered = [...entries].reverse().map((e) => ({ ...e, id: nextId.current++ }));
      setLines((prev) => [...numbered, ...prev].slice(0, MAX_LINES));
    };

    // Lines from outside services arrive later; anything that lands after a rematch started is dropped.
    function addLater(load: Promise<Pending | null>) {
      const epoch = opening.current.epoch;
      void load.then((line) => {
        if (line && opening.current.epoch === epoch) add([line]);
      });
    }

    // The mover's big moments: trash talk after winning material, advice after leaving a piece hanging. Rate limited.
    function addBit(kind: string, ply: number, player: string) {
      if (ply - lastBitPly.current < BIT_COOLDOWN_PLIES) return;
      if (kind === 'queenTaken' || kind === 'bigCapture') {
        lastBitPly.current = ply;
        addLater(dadJoke().then((joke) => (joke ? { kind: 'trash', tag: `Trash talk from ${player}`, text: joke } : null)));
      } else if (kind === 'hangingPiece') {
        lastBitPly.current = ply;
        addLater(adviceSlip().then((advice) => (advice ? { kind: 'advice', tag: `Life advice for ${player}`, text: advice } : null)));
      }
    }

    function announceOpening(move: Move, ply: number): Pending | null {
      const name = book && ply < OPENING_PLIES ? openingName(book, game) : null;
      const tracker = opening.current;
      if (!name || family(name) === tracker.family) return null;
      tracker.family = family(name);
      setCurrentOpening(name);
      addLater(
        findOpeningFact(name).then((fact: OpeningFact | null) => {
          if (!fact || opening.current.quoted.has(fact.title)) return null;
          opening.current.quoted.add(fact.title);
          return { kind: 'fact', tag: 'Did you know?', text: fact.text, source: { title: fact.title, url: fact.url } };
        }),
      );
      return { kind: 'openingName', text: pick({ kind: 'openingName', facts: { ...factsFor(move, namesRef.current), opening: withArticle(name) } }) };
    }

    if (myColor === null) return;
    const before = seen.current;
    seen.current = { plies: moves.length, ended: Boolean(result) };
    if (!before) return;

    if (moves.length < before.plies) {
      // A rematch started.
      setLines([]);
      setCurrentOpening(null);
      opening.current = { epoch: opening.current.epoch + 1, family: '', quoted: new Set() };
      lastBitPly.current = -BIT_COOLDOWN_PLIES;
    }
    const said: Pending[] = [];
    if (moves.length === before.plies + 1) {
      const move = game.history({ verbose: true }).at(-1);
      if (move) {
        const event = detectMoveEvent(game, move, moves.length - 1, namesRef.current);
        said.push({ kind: event.kind, text: pick(event), move: { number: Math.floor((moves.length - 1) / 2) + 1, san: move.san, color: move.color } });
        addBit(event.kind, moves.length - 1, event.facts.player);
        const named = announceOpening(move, moves.length - 1);
        if (named) said.push(named);
      }
    }
    if (result && !before.ended) {
      const end = detectEndEvent(result, namesRef.current);
      if (end) said.push({ kind: end.kind, text: pick(end) });
      if (result.winner) {
        const winner = namesRef.current[result.winner] || (result.winner === 'w' ? 'White' : 'Black');
        addLater(kanyeQuote().then((quote) => (quote ? { kind: 'interview', tag: `Post-game interview with ${winner}`, text: `“${quote}”` } : null)));
      }
    }
    if (said.length > 0) add(said);
  }, [moves, result, myColor, game, pick, book]);

  return { lines, opening: currentOpening };
}
