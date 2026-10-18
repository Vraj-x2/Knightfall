import { useState } from 'react';
import styles from './Panels.module.css';

export function Resign({ onResign }: { onResign: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="btn btn-danger" onClick={() => setConfirming(true)}>
        Resign
      </button>
    );
  }
  return (
    <span className={styles.confirm}>
      Resign this game?
      <button
        className="btn btn-danger"
        onClick={() => {
          setConfirming(false);
          onResign();
        }}
      >
        Yes, resign
      </button>
      <button className="btn" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}
