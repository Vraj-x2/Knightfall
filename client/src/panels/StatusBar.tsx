import { useGame } from '../game/GameContext';
import { lastMoveText, statusText } from '../game/selectors';
import styles from './Panels.module.css';

export function StatusBar() {
  const { state, game } = useGame();
  const online = state.opponentOnline;
  return (
    <>
      <div className={styles.status} role="status" aria-live="polite">
        <span
          className={`${styles.dot} ${online ? styles.online : ''}`}
          role="img"
          aria-label={online ? 'Opponent online' : 'Opponent offline'}
          title={online ? 'Opponent online' : 'Opponent offline'}
        />
        {statusText(state, game)}
      </div>
      <div className={styles.srOnly} aria-live="polite">
        {lastMoveText(state)}
      </div>
    </>
  );
}
