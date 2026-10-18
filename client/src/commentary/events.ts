import type { Chess, Move, PieceSymbol, Square } from 'chess.js';
import type { Color, GameResult } from '../net/protocol';
import { PIECE_VALUES } from '../game/selectors';

// Everything the commentator can react to, roughly from most to least exciting.
export type EventKind =
  | 'checkmate'
  | 'promotion'
  | 'queenTaken'
  | 'bigCapture'
  | 'hangingPiece'
  | 'enPassant'
  | 'check'
  | 'castleKingside'
  | 'castleQueenside'
  | 'trade'
  | 'capture'
  | 'kingWalk'
  | 'opening'
  | 'development'
  | 'quiet';

export type EndKind = 'resignation' | 'timeout' | 'draw' | 'stalemate';
export type InfoKind = 'openingName';

// The facts a line may mention. Every field is read off the real board, so lines can't invent anything.
export type CommentFacts = {
  side: string; // "White" / "Black"
  player: string; // the mover's name, or their side if unnamed
  opponent: string;
  piece: string;
  captured: string;
  to: string;
  promoted: string;
  opening?: string;
};

export type CommentEvent = { kind: EventKind | EndKind | InfoKind; facts: CommentFacts };

const NAMES: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const SIDE: Record<Color, string> = { w: 'White', b: 'Black' };
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
const OPENING_PLIES = 4;

export type Names = Record<Color, string>;

export function factsFor(move: Pick<Move, 'color' | 'piece' | 'to' | 'captured' | 'promotion'>, names: Names): CommentFacts {
  return {
    side: SIDE[move.color],
    player: names[move.color] || SIDE[move.color],
    opponent: names[other(move.color)] || SIDE[other(move.color)],
    piece: NAMES[move.piece],
    captured: move.captured ? NAMES[move.captured] : '',
    to: move.to,
    promoted: move.promotion ? NAMES[move.promotion] : '',
  };
}

// The moved piece can be taken and nothing defends it (or it's worth more than its cheapest attacker).
function isHanging(after: Chess, move: Move): boolean {
  if (move.piece === 'k' || move.piece === 'p') return false;
  // Grabbing something at least as valuable is a trade, not a blunder.
  if (move.captured && PIECE_VALUES[move.captured] >= PIECE_VALUES[move.piece]) return false;
  const square = move.to as Square;
  const attackers = after.attackers(square, other(move.color));
  if (attackers.length === 0) return false;
  const defended = after.attackers(square, move.color).length > 0;
  const cheapest = Math.min(...attackers.map((sq) => PIECE_VALUES[after.get(sq)!.type]));
  return !defended || cheapest < PIECE_VALUES[move.piece];
}

// Picks the single most interesting thing about a move that has just been played on `after`.
export function detectMoveEvent(after: Chess, move: Move, ply: number, names: Names): CommentEvent {
  const facts = factsFor(move, names);
  const kind = ((): EventKind => {
    if (after.isCheckmate()) return 'checkmate';
    if (move.promotion) return 'promotion';
    if (move.captured === 'q') return 'queenTaken';
    if (isHanging(after, move) && !after.inCheck()) return 'hangingPiece';
    if (move.isEnPassant()) return 'enPassant';
    if (after.inCheck()) return 'check';
    if (move.isKingsideCastle()) return 'castleKingside';
    if (move.isQueensideCastle()) return 'castleQueenside';
    if (move.captured) {
      const gain = PIECE_VALUES[move.captured];
      const recapturable = after.attackers(move.to as Square, other(move.color)).length > 0;
      if (gain >= 5 || (gain >= 3 && !recapturable)) return 'bigCapture';
      return recapturable && PIECE_VALUES[move.piece] === gain ? 'trade' : 'capture';
    }
    if (move.piece === 'k') return 'kingWalk';
    if (ply < OPENING_PLIES) return 'opening';
    if ((move.piece === 'n' || move.piece === 'b') && (move.from[1] === '1' || move.from[1] === '8')) return 'development';
    return 'quiet';
  })();
  return { kind, facts };
}

// Game endings that aren't a move: checkmate is already covered by detectMoveEvent.
export function detectEndEvent(result: GameResult, names: Names): CommentEvent | null {
  if (result.reason === 'checkmate') return null;
  const loser: Color | null = result.winner ? other(result.winner) : null;
  const kind: EndKind =
    result.reason === 'resignation' ? 'resignation' : result.reason === 'timeout' ? 'timeout' : result.reason === 'stalemate' ? 'stalemate' : 'draw';
  const mover = loser ?? 'w';
  return {
    kind,
    facts: {
      side: SIDE[mover],
      player: names[mover] || SIDE[mover],
      opponent: names[other(mover)] || SIDE[other(mover)],
      piece: '',
      captured: '',
      to: '',
      promoted: '',
    },
  };
}
