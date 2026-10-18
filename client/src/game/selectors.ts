import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { Color, GameResult, MoveRecord } from '../net/protocol';
import type { GameState } from './gameReducer';

// History is replayed (not just the FEN) so threefold repetition and the 50-move rule work.
export function replay(moves: MoveRecord[]): Chess {
  const game = new Chess();
  for (const { from, to, promotion } of moves) game.move({ from, to, promotion });
  return game;
}

export const legalMovesFrom = (game: Chess, square: string): Move[] =>
  game.moves({ square: square as Square, verbose: true });

export const findLegalMove = (game: Chess, from: string, to: string, promotion?: string): Move | undefined =>
  legalMovesFrom(game, from).find((m) => m.to === to && m.promotion === promotion);

export const isPromotionMove = (game: Chess, from: string, to: string): boolean =>
  legalMovesFrom(game, from).some((m) => m.to === to && m.promotion);

export function checkedKingSquare(game: Chess): string | null {
  if (!game.inCheck()) return null;
  for (const row of game.board()) {
    for (const cell of row) {
      if (cell?.type === 'k' && cell.color === game.turn()) return cell.square;
    }
  }
  return null;
}

export const lastMoveSquares = (moves: MoveRecord[]): string[] => {
  const last = moves[moves.length - 1];
  return last ? [last.from, last.to] : [];
};

export function canMove(state: GameState, game: Chess): boolean {
  return (
    state.viewPly === null &&
    state.connection === 'open' &&
    state.opponentOnline &&
    !state.result &&
    state.myColor !== null &&
    game.turn() === state.myColor
  );
}

export function statusText(state: GameState, game: Chess): string {
  const { result, myColor, connection, opponentOnline, moves, viewPly } = state;
  if (viewPly !== null) return `Viewing move ${viewPly} of ${moves.length}`;
  if (result) {
    if (!result.winner) return `Draw: ${result.reason}`;
    const outcome = result.winner === myColor ? 'you win' : 'you lose';
    return result.reason === 'checkmate' ? `Checkmate, ${outcome}` : `${outcome[0].toUpperCase()}${outcome.slice(1)} by ${result.reason}`;
  }
  if (connection === 'connecting') return 'Connecting…';
  if (connection !== 'open') return 'Reconnecting…';
  if (!opponentOnline) return moves.length === 0 ? 'Waiting for opponent' : 'Opponent disconnected';
  const mine = game.turn() === (myColor as Color);
  const turn = mine ? 'Your move' : "Opponent's move";
  return game.inCheck() ? `Check. ${turn}` : turn;
}

export const PIECE_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Pieces each side has taken (keyed by the capturing colour), most valuable first.
export function capturedBy(game: Chess): Record<Color, PieceSymbol[]> {
  const taken: Record<Color, PieceSymbol[]> = { w: [], b: [] };
  for (const move of game.history({ verbose: true })) {
    if (move.captured) taken[move.color].push(move.captured);
  }
  for (const color of ['w', 'b'] as const) taken[color].sort((a, b) => PIECE_VALUES[b] - PIECE_VALUES[a]);
  return taken;
}

// White minus black, counted from the board so promotions are included.
export function materialDiff(game: Chess): number {
  let diff = 0;
  for (const row of game.board()) {
    for (const cell of row) {
      if (cell) diff += PIECE_VALUES[cell.type] * (cell.color === 'w' ? 1 : -1);
    }
  }
  return diff;
}

// Screen-reader announcement for the newest move.
export function lastMoveText({ moves, myColor }: GameState): string {
  if (moves.length === 0) return '';
  const mover: Color = (moves.length - 1) % 2 === 0 ? 'w' : 'b';
  return `${mover === myColor ? 'You' : 'Opponent'} played ${moves[moves.length - 1].san}`;
}

// Game-over detection for games with no server (the same outcomes, in the same order, as server/rooms.js).
export function localResult(game: Chess): GameResult | null {
  if (game.isCheckmate()) return { winner: game.turn() === 'w' ? 'b' : 'w', reason: 'checkmate' };
  if (game.isStalemate()) return { winner: null, reason: 'stalemate' };
  if (game.isInsufficientMaterial()) return { winner: null, reason: 'insufficient material' };
  if (game.isThreefoldRepetition()) return { winner: null, reason: 'threefold repetition' };
  if (game.isDraw()) return { winner: null, reason: '50-move rule' };
  return null;
}
