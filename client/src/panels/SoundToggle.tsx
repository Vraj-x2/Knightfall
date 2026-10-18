import { useState } from 'react';
import { isMuted, setMuted } from '../game/sounds';

export function SoundToggle() {
  const [muted, setLocal] = useState(isMuted);
  return (
    <button
      className="btn"
      aria-pressed={!muted}
      onClick={() => {
        setMuted(!muted);
        setLocal(!muted);
      }}
    >
      {muted ? 'Sound off' : 'Sound on'}
    </button>
  );
}
