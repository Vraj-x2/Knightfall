import type { CSSProperties } from 'react';
import type { Color } from '../net/protocol';
import styles from './Piece.module.css';

// Filled glyphs for both sides (coloured in CSS). U+FE0E stops phones swapping in the emoji pawn.
const GLYPHS: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎' };

// Offset, in squares, the piece starts from when it slides into place.
export type Slide = { dx: number; dy: number; key: string };

type Props = { type: string; color: Color; floating?: boolean; slide?: Slide };

// Decorative: the square's aria-label already names the piece for screen readers.
export function Piece({ type, color, floating, slide }: Props) {
  const cls = [styles.piece, color === 'w' ? styles.white : styles.black, floating && styles.floating, slide && styles.slide]
    .filter(Boolean)
    .join(' ');
  const style = slide ? ({ '--dx': slide.dx, '--dy': slide.dy } as CSSProperties) : undefined;
  return (
    <span className={cls} style={style} aria-hidden="true">
      {GLYPHS[type]}
    </span>
  );
}
