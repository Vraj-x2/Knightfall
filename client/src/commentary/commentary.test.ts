import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { detectEndEvent, detectMoveEvent } from './events';
import { createLinePicker, fill } from './linePicker';
import { LINES } from './lines';

const names = { w: 'Ana', b: 'Ben' };

// Plays the moves and reports the event for the last one.
function eventAfter(sans: string[], fen?: string) {
  const game = new Chess(fen);
  for (const san of sans) game.move(san);
  const move = game.history({ verbose: true }).at(-1)!;
  return detectMoveEvent(game, move, game.history().length - 1, names);
}

describe('detectMoveEvent', () => {
  it('calls the first moves the opening', () => {
    expect(eventAfter(['e4']).kind).toBe('opening');
  });

  it('spots checkmate', () => {
    expect(eventAfter(['f3', 'e5', 'g4', 'Qh4#']).kind).toBe('checkmate');
  });

  it('spots castling on each side', () => {
    expect(eventAfter(['O-O'], 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1').kind).toBe('castleKingside');
    expect(eventAfter(['O-O-O'], 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1').kind).toBe('castleQueenside');
  });

  it('spots a queen capture', () => {
    expect(eventAfter(['Rxd8'], '3qk3/8/8/8/8/8/8/3RK3 w - - 0 1').kind).toBe('queenTaken');
  });

  it('spots a piece moved onto an undefended attacked square', () => {
    // The knight lands where the black pawn can take it.
    expect(eventAfter(['Nd5'], '4k3/8/4p3/8/8/2N5/8/4K3 w - - 0 1').kind).toBe('hangingPiece');
  });

  it('treats an equal recapturable swap as a trade, not a blunder', () => {
    expect(eventAfter(['Nxd5'], '4k3/8/4p3/3n4/8/2N5/8/4K3 w - - 0 1').kind).toBe('trade');
  });

  it('spots promotion and en passant', () => {
    expect(eventAfter(['a8=Q'], '4k3/P7/8/8/8/8/8/4K3 w - - 0 1').facts.promoted).toBe('queen');
    expect(eventAfter(['exd6'], '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1').kind).toBe('enPassant');
  });

  it('fills facts from the real board', () => {
    const { facts } = eventAfter(['e4']);
    expect(facts).toMatchObject({ player: 'Ana', opponent: 'Ben', piece: 'pawn', to: 'e4', side: 'White' });
  });
});

describe('detectEndEvent', () => {
  it('names the player who resigned and skips checkmate', () => {
    expect(detectEndEvent({ winner: 'w', reason: 'resignation' }, names)?.facts.player).toBe('Ben');
    expect(detectEndEvent({ winner: 'w', reason: 'checkmate' }, names)).toBeNull();
  });
});

describe('line picker', () => {
  it('uses every template once before repeating, and never twice in a row', () => {
    const pick = createLinePicker();
    const event = eventAfter(['e4', 'e5', 'Nf3', 'Nc6', 'a3']);
    const count = LINES[event.kind].length;
    const firstRound = Array.from({ length: count }, () => pick(event));
    expect(new Set(firstRound).size).toBe(count);
    let previous = firstRound.at(-1);
    for (let i = 0; i < count * 5; i++) {
      const line = pick(event);
      expect(line).not.toBe(previous);
      previous = line;
    }
  });

  it('fills every blank and capitalises the first letter', () => {
    const facts = { side: 'White', player: 'Ana', opponent: 'Ben', piece: 'knight', captured: 'pawn', to: 'f3', promoted: '' };
    expect(fill('{piece} to {to}, {player}!', facts)).toBe('Knight to f3, Ana!');
    for (const templates of Object.values(LINES)) {
      for (const t of templates) expect(fill(t, facts)).not.toMatch(/[{}]/);
    }
  });
});

describe('fill capitalisation', () => {
  it('capitalises a blank that starts a later sentence', () => {
    const facts = { side: 'White', player: 'Ana', opponent: 'Ben', piece: 'pawn', captured: '', to: 'd4', promoted: '' };
    expect(fill('{player} keeps it calm. {piece} to {to}.', facts)).toBe('Ana keeps it calm. Pawn to d4.');
  });
});
