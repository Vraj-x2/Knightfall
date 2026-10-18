import styles from './Panels.module.css';

// Stockfish is GPL-3.0: the notice and links travel with the app (the licence text is served at /engine/COPYING.txt).
export function EngineCredit() {
  return (
    <p className={styles.credit}>
      Computer opponent: <a href="https://stockfishchess.org" target="_blank" rel="noopener noreferrer">Stockfish</a> via{' '}
      <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener noreferrer">Stockfish.js</a>, licensed{' '}
      <a href="/engine/COPYING.txt" target="_blank" rel="noopener noreferrer">GPL-3.0</a>.
    </p>
  );
}
