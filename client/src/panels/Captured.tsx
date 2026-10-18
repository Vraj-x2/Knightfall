import { Piece } from '../board/Piece';
import { useGame } from '../game/GameContext';
import { capturedBy, materialDiff } from '../game/selectors';
import type { Color } from '../net/protocol';
import styles from './Panels.module.css';

// Pieces `color` has taken, plus the material lead if `color` is ahead. Follows the position being viewed.
export function Captured({ color }: { color: Color }) {
  const { viewGame } = useGame();
  const taken = capturedBy(viewGame)[color];
  const lead = (color === 'w' ? 1 : -1) * materialDiff(viewGame);
  const victim: Color = color === 'w' ? 'b' : 'w';
  const name = color === 'w' ? 'White' : 'Black';

  return (
    <div className={styles.captured} role="group" aria-label={`Captured by ${name}${lead > 0 ? `, ahead by ${lead}` : ''}`}>
      {taken.map((type, i) => (
        <Piece key={i} type={type} color={victim} />
      ))}
      {lead > 0 && <span className={styles.lead}>+{lead}</span>}
    </div>
  );
}
