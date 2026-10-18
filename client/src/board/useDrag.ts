import { useRef, useState, type PointerEvent } from 'react';
import type { Color } from '../net/protocol';

const FILES = 'abcdefgh';
const DRAG_THRESHOLD_PX = 4;

type Rect = { left: number; top: number; width: number; height: number };

// Maps a pointer position to a square name; null when outside the board.
export function squareFromPoint(x: number, y: number, rect: Rect, orientation: Color): string | null {
  const size = rect.width / 8;
  const col = Math.floor((x - rect.left) / size);
  const row = Math.floor((y - rect.top) / (rect.height / 8));
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  const file = orientation === 'w' ? col : 7 - col;
  const rank = orientation === 'w' ? 8 - row : row + 1;
  return `${FILES[file]}${rank}`;
}

export type DragState = { from: string; x: number; y: number };

type Options = {
  orientation: Color;
  canDrag: (square: string) => boolean;
  onDragStart: (square: string) => void;
  onDrop: (from: string, to: string) => void;
  onTap: (square: string) => void;
};

// One pointer-event pipeline for both tap (click-to-move) and drag, so mouse and touch behave the same.
export function useDrag({ orientation, canDrag, onDragStart, onDrop, onTap }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const press = useRef<{ square: string | null; x: number; y: number; draggable: boolean } | null>(null);

  const squareAt = (e: PointerEvent<HTMLElement>) =>
    squareFromPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), orientation);

  return {
    drag,
    handlers: {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if (e.button !== 0) return;
        const square = squareAt(e);
        e.currentTarget.setPointerCapture(e.pointerId);
        press.current = { square, x: e.clientX, y: e.clientY, draggable: square !== null && canDrag(square) };
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        const p = press.current;
        if (!p || !p.square || !p.draggable) return;
        if (!drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD_PX) return;
        if (!drag) onDragStart(p.square);
        setDrag({ from: p.square, x: e.clientX, y: e.clientY });
      },
      onPointerUp(e: PointerEvent<HTMLElement>) {
        const p = press.current;
        press.current = null;
        if (!p) return;
        const target = squareAt(e);
        if (drag) {
          setDrag(null);
          if (target && target !== drag.from) onDrop(drag.from, target);
        } else if (target) {
          onTap(target);
        }
      },
      onPointerCancel() {
        press.current = null;
        setDrag(null);
      },
    },
  };
}
