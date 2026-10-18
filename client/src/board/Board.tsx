import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import type { Chess, Move } from 'chess.js';
import type { Color } from '../net/protocol';
import { cellToSquare, moveFocus, squareToCell } from './keyboard';
import { Piece } from './Piece';
import { Square } from './Square';
import { useDrag } from './useDrag';
import styles from './Board.module.css';

const FILES = 'abcdefgh';

type Props = {
  game: Chess;
  orientation: Color;
  selected: string | null;
  targets: Move[];
  lastMove: string[]; // [from, to] of the last move shown
  slideKey: string | null; // set when the last move should slide in
  checkSquare: string | null;
  canDrag: (square: string) => boolean;
  onDragStart: (square: string) => void;
  onDrop: (from: string, to: string) => void;
  onTap: (square: string) => void;
  onCancel: () => void;
};

export function Board(props: Props) {
  const { game, orientation, selected, targets, lastMove, slideKey, checkSquare, canDrag, onDragStart, onDrop, onTap, onCancel } = props;
  const { drag, handlers } = useDrag({ orientation, canDrag, onDragStart, onDrop, onTap });
  const [focus, setFocus] = useState('e2');
  const gridRef = useRef<HTMLDivElement>(null);
  const keyboardNav = useRef(false);

  // Move real DOM focus only after an arrow key, so pointer users never get focus stolen.
  useEffect(() => {
    if (!keyboardNav.current) return;
    keyboardNav.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-square="${focus}"]`)?.focus();
  }, [focus]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return onTap(focus);
    }
    if (e.key === 'Escape') return onCancel();
    const next = moveFocus(focus, e.key, orientation);
    if (next) {
      e.preventDefault();
      keyboardNav.current = true;
      setFocus(next);
    }
  }

  function onFocus(e: FocusEvent<HTMLDivElement>) {
    const square = (e.target as HTMLElement).dataset.square;
    if (square) setFocus(square);
  }

  const board = game.board();
  const rows = orientation === 'w' ? board : [...board].reverse().map((r) => [...r].reverse());
  const dragged = drag ? game.get(drag.from as never) : null;
  const slideFrom = slideKey && lastMove.length === 2 ? squareToCell(lastMove[0], orientation) : null;

  return (
    <div
      ref={gridRef}
      className={styles.board}
      role="grid"
      aria-label="Chess board. Arrow keys move, Enter selects or moves, Escape cancels."
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      {...handlers}
    >
      {rows.map((row, r) => (
        <div role="row" className={styles.row} key={r}>
          {row.map((piece, c) => {
            const name = cellToSquare(r, c, orientation);
            const file = FILES.indexOf(name[0]);
            const rank = Number(name[1]);
            const target = targets.find((m) => m.to === name);
            const slide =
              slideFrom && slideKey && name === lastMove[1]
                ? { dx: slideFrom.col - c, dy: slideFrom.row - r, key: slideKey }
                : undefined;
            return (
              <Square
                key={name}
                name={name}
                isLight={(file + rank) % 2 === 1}
                piece={piece ? { type: piece.type, color: piece.color } : null}
                rankLabel={c === 0 ? String(rank) : undefined}
                fileLabel={r === 7 ? FILES[file] : undefined}
                selected={selected === name}
                lastMove={lastMove.includes(name)}
                legalTarget={Boolean(target) && !piece}
                legalCapture={Boolean(target) && Boolean(piece || target?.flags.includes('e'))}
                check={checkSquare === name}
                hidden={drag?.from === name}
                focusable={focus === name}
                slide={slide}
              />
            );
          })}
        </div>
      ))}
      {drag && dragged && (
        <div className={styles.floating} style={{ transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -50%)` }}>
          <Piece type={dragged.type} color={dragged.color} floating />
        </div>
      )}
    </div>
  );
}
