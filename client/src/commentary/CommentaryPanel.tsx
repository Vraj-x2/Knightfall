import type { Names } from './events';
import { LINE_STYLE } from './lineStyle';
import { useCommentary, type CommentLine } from './useCommentary';
import styles from './Commentary.module.css';

const SIDE = { w: 'White', b: 'Black' } as const;

function MoveBadge({ move }: { move: NonNullable<CommentLine['move']> }) {
  return (
    <span className={styles.moveBadge} title={`${SIDE[move.color]}, move ${move.number}`}>
      <span className={`${styles.sideDot} ${move.color === 'w' ? styles.white : styles.black}`} aria-label={SIDE[move.color]} />
      {move.number}
      {move.color === 'w' ? '.' : '…'} {move.san}
    </span>
  );
}

function Source({ source }: { source: NonNullable<CommentLine['source']> }) {
  return (
    <a className={styles.source} href={source.url} target="_blank" rel="noopener noreferrer">
      Wikipedia: {source.title} ↗
    </a>
  );
}

// The newest line, broadcast-style: big, iconed, coloured by how big the moment is.
function Featured({ line }: { line: CommentLine }) {
  const { icon, tone } = LINE_STYLE[line.kind];
  return (
    <div key={line.id} className={`${styles.featured} ${styles[tone]}`}>
      <span className={styles.featuredIcon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.featuredBody}>
        <div className={styles.meta}>
          {line.tag && <span className={styles.tag}>{line.tag}</span>}
          {line.move && <MoveBadge move={line.move} />}
        </div>
        <p className={styles.featuredText}>{line.text}</p>
        {line.source && <Source source={line.source} />}
      </div>
    </div>
  );
}

function FeedItem({ line }: { line: CommentLine }) {
  const { icon, tone } = LINE_STYLE[line.kind];
  return (
    <li className={`${styles.item} ${tone === 'extra' ? styles.extraItem : ''}`}>
      <span className={styles.itemIcon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.itemBody}>
        {(line.tag || line.move) && (
          <div className={styles.meta}>
            {line.tag && <span className={styles.tag}>{line.tag}</span>}
            {line.move && <MoveBadge move={line.move} />}
          </div>
        )}
        <span>{line.text}</span>
        {line.source && <Source source={line.source} />}
      </div>
    </li>
  );
}

export function CommentaryPanel({ names }: { names: Names }) {
  const { lines, opening } = useCommentary(names);
  const [latest, ...older] = lines;
  return (
    <section className={styles.panel} aria-labelledby="commentary-title">
      <div className={styles.header}>
        <span className={styles.live}>
          <span className={styles.liveDot} aria-hidden="true" />
          Live
        </span>
        <h2 id="commentary-title">Commentary</h2>
      </div>
      {opening && (
        <p className={styles.opening}>
          <span aria-hidden="true">📖</span> {opening}
        </p>
      )}
      {latest ? (
        <>
          <Featured line={latest} />
          {older.length > 0 && (
            <ol className={styles.feed} aria-label="Earlier commentary">
              {older.map((line) => (
                <FeedItem key={line.id} line={line} />
              ))}
            </ol>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            🎙️
          </span>
          <p>The commentator is in the booth. Make the first move!</p>
        </div>
      )}
    </section>
  );
}
