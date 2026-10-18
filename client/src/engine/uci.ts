// The UCI text protocol Stockfish speaks over postMessage. Pure functions, no I/O.
import type { PromotionPiece } from '../net/protocol';

export type EngineMove = { from: string; to: string; promotion?: PromotionPiece };

const MOVE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

// Accepts any move-shaped record (the game's MoveRecord included), since only the squares matter.
export function positionCommand(moves: { from: string; to: string; promotion?: string }[]): string {
  if (moves.length === 0) return 'position startpos';
  return `position startpos moves ${moves.map((m) => `${m.from}${m.to}${m.promotion ?? ''}`).join(' ')}`;
}

export const goCommand = (movetimeMs: number): string => `go movetime ${movetimeMs}`;

// null: not a bestmove line. { move: null }: the engine has no move to offer.
export function parseBestMove(line: string): { move: EngineMove | null } | null {
  const [keyword, token] = line.trim().split(/\s+/);
  if (keyword !== 'bestmove') return null;
  const match = MOVE.exec(token ?? '');
  if (!match) return { move: null };
  const [, from, to, promotion] = match;
  return { move: promotion ? { from, to, promotion: promotion as PromotionPiece } : { from, to } };
}
