import { useEffect, useState } from 'react';
import type { Names } from './events';
import { loadVoiceOn, saveVoiceOn, speechSupported, stopSpeaking } from './speech';
import { useCommentary } from './useCommentary';
import styles from './Commentary.module.css';

export function CommentaryPanel({ names }: { names: Names }) {
  const [voiceOn, setVoiceOn] = useState(() => speechSupported() && loadVoiceOn());
  const lines = useCommentary(names, voiceOn);

  useEffect(() => stopSpeaking, []); // leaving the game silences the commentator

  return (
    <section className={styles.panel} aria-labelledby="commentary-title">
      <div className={styles.header}>
        <span className={styles.onAir} aria-hidden="true" />
        <h2 id="commentary-title">Commentary</h2>
        {speechSupported() && (
          <button
            className={styles.voice}
            aria-pressed={voiceOn}
            onClick={() => {
              saveVoiceOn(!voiceOn);
              setVoiceOn(!voiceOn);
            }}
          >
            {voiceOn ? 'Voice on' : 'Voice off'}
          </button>
        )}
      </div>
      {lines.length === 0 ? (
        <p className={styles.empty}>The commentator is ready. Make a move!</p>
      ) : (
        <ol className={styles.feed}>
          {lines.map((line, i) => (
            <li key={line.id} className={i === 0 ? styles.latest : undefined}>
              {line.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
