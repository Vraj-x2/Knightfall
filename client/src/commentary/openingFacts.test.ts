import { Chess } from 'chess.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openingName, positionKey } from './openings';
import { candidateTitles, findOpeningFact, pickFact } from './wikipedia';

const RUY_EXTRACT =
  'The Ruy Lopez, also called the Spanish Opening, is a chess opening beginning with the moves:\n\n1. e4 e5\n2. Nf3 Nc6\n3. Bb5\n' +
  'White develops the bishop to the active square b5. Recommended by the 16th century Spanish priest Ruy López de Segura, it is still played.';

function page(title: string, extract: string) {
  return new Response(JSON.stringify({ query: { pages: [{ title, extract }] } }));
}

describe('opening names', () => {
  it('names a position however it was reached', () => {
    const book = { [positionKey(new Chess('rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2').fen())]: 'Sicilian Defense' };
    const viaE4 = new Chess();
    ['e4', 'c5', 'Nf3'].forEach((m) => viaE4.move(m));
    const viaNf3 = new Chess();
    ['Nf3', 'c5', 'e4'].forEach((m) => viaNf3.move(m));
    expect(openingName(book, viaE4)).toBe('Sicilian Defense');
    expect(openingName(book, viaNf3)).toBe('Sicilian Defense');
  });
});

describe('Wikipedia facts', () => {
  // Tests run in Node, which has no localStorage: give each test an empty in-memory one.
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    });
  });

  it('maps Lichess names to Wikipedia titles, most specific first', () => {
    expect(candidateTitles('Sicilian Defense: Najdorf Variation, English Attack')).toEqual([
      'Sicilian Defence, Najdorf Variation',
      'Sicilian Defence',
    ]);
    expect(candidateTitles('Ruy Lopez')).toEqual(['Ruy Lopez']);
  });

  it('prefers a trivia sentence and skips the move list', () => {
    expect(pickFact(RUY_EXTRACT)).toBe('Recommended by the 16th century Spanish priest Ruy López de Segura, it is still played.');
  });

  it('falls back to the family page and links the article', async () => {
    const asked: string[] = [];
    const fetcher = (async (url: string) => {
      const title = new URL(url).searchParams.get('titles')!;
      asked.push(title);
      return title === 'Ruy Lopez' ? page('Ruy Lopez', RUY_EXTRACT) : new Response(JSON.stringify({ query: { pages: [{ missing: true }] } }));
    }) as typeof fetch;
    const fact = await findOpeningFact('Ruy Lopez: Morphy Defense', fetcher);
    expect(asked).toEqual(['Ruy Lopez, Morphy Defence', 'Ruy Lopez']);
    expect(fact?.url).toBe('https://en.wikipedia.org/wiki/Ruy_Lopez');
  });

  it('rejects a redirect to an unrelated page', async () => {
    const fetcher = (async () => page("King's Pawn Game", 'The most popular first move in chess since the 19th century, played by every world champion.')) as typeof fetch;
    expect(await findOpeningFact('Borg Defense', fetcher)).toBeNull();
  });

  it('retries after a failed request instead of remembering "no fact"', async () => {
    let calls = 0;
    const fetcher = (async () => (++calls === 1 ? new Response('You are making too many requests') : page('London System', 'The London System was popularised in the 20th century by many grandmasters.'))) as typeof fetch;
    expect(await findOpeningFact('London System', fetcher)).toBeNull();
    expect((await findOpeningFact('London System', fetcher))?.title).toBe('London System');
  });
});
