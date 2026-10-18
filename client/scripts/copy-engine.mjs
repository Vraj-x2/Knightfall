// Copies the single-threaded lite Stockfish build (about 1.8 MB, no special server headers needed)
// from node_modules into public/engine so it is served as a static file next to the app.
// Run automatically before `dev` and `build`; the output is git-ignored.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'stockfish');
const target = join(root, 'public', 'engine');
const files = [
  ['bin/stockfish-19-lite-single.js', 'stockfish-lite-single.js'],
  ['bin/stockfish-19-lite-single.wasm', 'stockfish-lite-single.wasm'],
  ['Copying.txt', 'COPYING.txt'], // GPL-3.0 text, shipped with the engine
];

mkdirSync(target, { recursive: true });
for (const [from, to] of files) {
  const src = join(source, from);
  if (!existsSync(src)) throw new Error(`Missing ${src}. Run "npm install" first.`);
  cpSync(src, join(target, to));
}
console.log(`engine files copied to ${target}`);
