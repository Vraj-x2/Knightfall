import { useEffect, useRef } from 'react';
import { useGame } from '../game/GameContext';
import styles from './Panels.module.css';

export function MoveList() {
  const { state, dispatch } = useGame();
  const { moves, viewPly } = state;
  const current = viewPly ?? moves.length;
  const scroller = useRef<HTMLDivElement>(null);

  // Follow the game while live; leave the scroll position alone while the player is reading history.
  useEffect(() => {
    if (viewPly === null) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [moves.length, viewPly]);

  const pairs = Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => i);
  const cell = (ply: number) =>
    moves[ply] && (
      <button
        className={`${styles.ply} ${current === ply + 1 ? styles.currentPly : ''}`}
        aria-current={current === ply + 1 ? 'true' : undefined}
        onClick={() => dispatch({ type: 'VIEW_PLY', ply: ply + 1 })}
      >
        {moves[ply].san}
      </button>
    );

  return (
    <section className={styles.panel} aria-label="Moves">
      <div className={styles.panelHeader}>
        <h2>Moves</h2>
        {moves.length > 0 && (
          <button className={styles.link} onClick={() => dispatch({ type: 'VIEW_PLY', ply: 0 })}>
            Start
          </button>
        )}
        {viewPly !== null && (
          <button className={`btn btn-primary ${styles.small}`} onClick={() => dispatch({ type: 'VIEW_PLY', ply: null })}>
            Back to live
          </button>
        )}
      </div>
      <div className={styles.moveScroll} ref={scroller}>
        {moves.length === 0 ? (
          <p className={styles.empty}>No moves yet</p>
        ) : (
          <ol className={styles.moveGrid}>
            {pairs.map((i) => (
              <li key={i}>
                <span className={styles.moveNo}>{i + 1}.</span>
                {cell(i * 2)}
                {cell(i * 2 + 1)}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
