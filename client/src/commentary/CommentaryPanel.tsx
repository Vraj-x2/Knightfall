import type { Names } from './events';
import { useCommentary } from './useCommentary';
import styles from './Commentary.module.css';

export function CommentaryPanel({ names }: { names: Names }) {
  const lines = useCommentary(names);
  return (
    <section className={styles.panel} aria-labelledby="commentary-title">
      <div className={styles.header}>
        <span className={styles.onAir} aria-hidden="true" />
        <h2 id="commentary-title">Commentary</h2>
      </div>
      {lines.length === 0 ? (
        <p className={styles.empty}>The commentator is ready. Make a move!</p>
      ) : (
        <ol className={styles.feed}>
          {lines.map((line, i) => (
            <li key={line.id} className={`${i === 0 ? styles.latest : ''} ${line.tag ? styles.fact : ''}`}>
              {line.tag && <span className={styles.factTag}>{line.tag}</span>}
              {line.text}
              {line.source && (
                <a className={styles.sourceLink} href={line.source.url} target="_blank" rel="noopener noreferrer">
                  Wikipedia: {line.source.title}
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
