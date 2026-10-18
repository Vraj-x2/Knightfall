import type { Color } from '../net/protocol';

const FILES = 'abcdefgh';
const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

// Display cell (row 0 = top of the screen) for a square, given which side is at the bottom.
export function squareToCell(square: string, orientation: Color): { row: number; col: number } {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return orientation === 'w' ? { row: 8 - rank, col: file } : { row: rank - 1, col: 7 - file };
}

export function cellToSquare(row: number, col: number, orientation: Color): string {
  const file = orientation === 'w' ? col : 7 - col;
  const rank = orientation === 'w' ? 8 - row : row + 1;
  return `${FILES[file]}${rank}`;
}

const clamp = (n: number) => Math.min(7, Math.max(0, n));

// Arrow keys move focus the way the board looks on screen; other keys return null.
export function moveFocus(square: string, key: string, orientation: Color): string | null {
  const delta = ARROWS[key];
  if (!delta) return null;
  const { row, col } = squareToCell(square, orientation);
  return cellToSquare(clamp(row + delta[0]), clamp(col + delta[1]), orientation);
}
