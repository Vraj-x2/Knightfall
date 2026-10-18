import { useEffect, useRef } from 'react';
import type { Color, PromotionPiece } from '../net/protocol';
import { Piece } from './Piece';
import styles from './PromotionPicker.module.css';

const CHOICES: PromotionPiece[] = ['q', 'r', 'b', 'n'];

type Props = { color: Color; onPick: (piece: PromotionPiece) => void; onCancel: () => void };

export function PromotionPicker({ color, onPick, onCancel }: Props) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <div
      className={styles.backdrop}
      onClick={onCancel}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      role="dialog"
      aria-label="Choose promotion piece"
    >
      <div className={styles.picker} onClick={(e) => e.stopPropagation()}>
        {CHOICES.map((piece) => (
          <button
            key={piece}
            ref={piece === 'q' ? first : undefined}
            className={styles.choice}
            onClick={() => onPick(piece)}
            aria-label={`Promote to ${piece}`}
          >
            <Piece type={piece} color={color} />
          </button>
        ))}
      </div>
    </div>
  );
}
