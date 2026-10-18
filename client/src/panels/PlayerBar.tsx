import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../net/socket';
import type { Color } from '../net/protocol';
import { Captured } from './Captured';
import { ClockFace } from './ClockFace';
import styles from './Panels.module.css';

type Props = {
  color: Color;
  name: string;
  editable?: boolean;
  onRename?: (name: string) => void;
};

const defaultName = (color: Color) => (color === 'w' ? 'White' : 'Black');

// One side of the board: who is playing (editable for you) plus what they have captured.
export function PlayerBar({ color, name, editable, onRename }: Props) {
  return (
    <div className={styles.playerBar}>
      {editable && onRename ? (
        <NameField value={name} placeholder={`${defaultName(color)} (you)`} onCommit={onRename} />
      ) : (
        <span className={styles.playerName}>{name || defaultName(color)}</span>
      )}
      <Captured color={color} />
      <ClockFace color={color} />
    </div>
  );
}

function NameField({ value, placeholder, onCommit }: { value: string; placeholder: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    const next = draft.trim();
    setDraft(next);
    if (next !== value) onCommit(next);
  };
  return (
    <input
      className={styles.nameInput}
      aria-label="Your name"
      value={draft}
      placeholder={placeholder}
      maxLength={MAX_NAME_LENGTH}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}
