import type { PieceSymbol, Color } from 'chess.js';
import { Piece, type Slide } from './Piece';
import styles from './Square.module.css';

export type SquareProps = {
  name: string;
  isLight: boolean;
  piece: { type: PieceSymbol; color: Color } | null;
  rankLabel?: string;
  fileLabel?: string;
  selected: boolean;
  lastMove: boolean;
  legalTarget: boolean;
  legalCapture: boolean;
  check: boolean;
  hidden: boolean;
  focusable: boolean;
  slide?: Slide;
};

const PIECE_NAMES: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

function describe(p: SquareProps): string {
  const what = p.piece ? `${p.piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[p.piece.type]}` : 'empty';
  const notes = [
    p.selected && 'selected',
    (p.legalTarget || p.legalCapture) && 'legal move',
    p.check && 'in check',
    p.lastMove && 'last move',
  ].filter(Boolean);
  return [p.name, what, ...notes].join(', ');
}

export function Square(p: SquareProps) {
  const cls = [
    styles.square,
    p.isLight ? styles.light : styles.dark,
    p.selected && styles.selected,
    p.lastMove && styles.lastMove,
    p.check && styles.check,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      role="gridcell"
      data-square={p.name}
      aria-label={describe(p)}
      aria-selected={p.selected}
      tabIndex={p.focusable ? 0 : -1}
    >
      {p.legalTarget && <span className={styles.dot} />}
      {p.legalCapture && <span className={styles.ring} />}
      {p.piece && !p.hidden && <Piece key={p.slide?.key} type={p.piece.type} color={p.piece.color} slide={p.slide} />}
      {p.rankLabel && <span className={`${styles.label} ${styles.rank}`} aria-hidden="true">{p.rankLabel}</span>}
      {p.fileLabel && <span className={`${styles.label} ${styles.file}`} aria-hidden="true">{p.fileLabel}</span>}
    </div>
  );
}
