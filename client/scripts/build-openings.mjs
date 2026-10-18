// Builds public/openings.json from the Lichess opening list (CC0: https://github.com/lichess-org/chess-openings).
// Keyed by position rather than move order, so transpositions still get named. Run: node scripts/build-openings.mjs
import { writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';
const byPosition = {};

for (const file of ['a', 'b', 'c', 'd', 'e']) {
  const res = await fetch(`${BASE}/${file}.tsv`);
  if (!res.ok) throw new Error(`Could not download ${file}.tsv: ${res.status}`);
  const rows = (await res.text()).trim().split('\n').slice(1);
  for (const row of rows) {
    const [, name, pgn] = row.split('\t');
    const game = new Chess();
    for (const san of pgn.replace(/\d+\.\s*/g, '').split(/\s+/)) game.move(san);
    byPosition[positionKey(game.fen())] = name;
  }
}

// Placement, side to move, castling, en passant: the move counters don't change the opening.
function positionKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

const url = new URL('../public/openings.json', import.meta.url);
writeFileSync(url, JSON.stringify(byPosition));
console.log(`wrote ${Object.keys(byPosition).length} openings`);
