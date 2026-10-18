import type { Reaction } from './giphy';
import styles from './ReactionOverlay.module.css';

// The GIF floats over the board for a moment and fades on its own. Clicks pass through, so play never waits on it.
// Giphy requires its attribution.
export function ReactionOverlay({ reaction }: { reaction: Reaction | null }) {
  if (!reaction) return null;
  return (
    <div className={styles.overlay} aria-hidden="true">
      <figure className={styles.card}>
        <img src={reaction.url} alt="" />
        <figcaption>Powered by GIPHY</figcaption>
      </figure>
    </div>
  );
}
