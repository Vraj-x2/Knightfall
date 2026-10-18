import type { CommentEvent } from './events';

export type ExtraKind = 'fact' | 'trash' | 'advice' | 'interview';
export type LineKind = CommentEvent['kind'] | ExtraKind;
// How loud a moment is: drives the colour of the featured card.
export type Tone = 'huge' | 'big' | 'normal' | 'calm' | 'extra';

export const LINE_STYLE: Record<LineKind, { icon: string; tone: Tone }> = {
  checkmate: { icon: '👑', tone: 'huge' },
  queenTaken: { icon: '💥', tone: 'huge' },
  resignation: { icon: '🏳️', tone: 'huge' },
  timeout: { icon: '⏰', tone: 'huge' },
  promotion: { icon: '⭐', tone: 'big' },
  bigCapture: { icon: '⚔️', tone: 'big' },
  hangingPiece: { icon: '⚠️', tone: 'big' },
  enPassant: { icon: '🤯', tone: 'big' },
  draw: { icon: '🤝', tone: 'big' },
  stalemate: { icon: '😶', tone: 'big' },
  check: { icon: '⚡', tone: 'normal' },
  castleKingside: { icon: '🏰', tone: 'normal' },
  castleQueenside: { icon: '🏰', tone: 'normal' },
  capture: { icon: '🗡️', tone: 'normal' },
  openingName: { icon: '📖', tone: 'normal' },
  trade: { icon: '🔄', tone: 'calm' },
  kingWalk: { icon: '🚶', tone: 'calm' },
  opening: { icon: '🎬', tone: 'calm' },
  development: { icon: '♞', tone: 'calm' },
  quiet: { icon: '💭', tone: 'calm' },
  fact: { icon: '💡', tone: 'extra' },
  trash: { icon: '😏', tone: 'extra' },
  advice: { icon: '🧘', tone: 'extra' },
  interview: { icon: '🎤', tone: 'extra' },
};
