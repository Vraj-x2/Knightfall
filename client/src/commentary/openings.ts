import type { Chess } from 'chess.js';

// Position -> opening name, built by scripts/build-openings.mjs from the Lichess opening list.
type OpeningBook = Record<string, string>;
let book: Promise<OpeningBook> | null = null;

export const positionKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

// Loaded once, on first use. A failed load is forgotten so the next game can retry.
export function loadOpenings(fetcher: typeof fetch = fetch): Promise<OpeningBook> {
  book ??= fetcher('/openings.json')
    .then((res) => {
      if (!res.ok) throw new Error(`openings.json: ${res.status}`);
      return res.json() as Promise<OpeningBook>;
    })
    .catch((error: unknown) => {
      book = null;
      throw error;
    });
  return book;
}

export const openingName = (openings: OpeningBook, game: Chess): string | null => openings[positionKey(game.fen())] ?? null;
