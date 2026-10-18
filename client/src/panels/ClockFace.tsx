import { useEffect, useState } from 'react';
import { formatClock, remainingMs } from '../game/clock';
import { useGame } from '../game/GameContext';
import type { Color } from '../net/protocol';
import styles from './Panels.module.css';

const TICK_MS = 100;
const LOW_MS = 10_000;

export function ClockFace({ color }: { color: Color }) {
  const { state } = useGame();
  const { clock, result } = state;
  const running = clock?.running === color && !result;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  if (!clock) return null;
  const ms = remainingMs(clock, color, performance.now());
  const text = formatClock(ms);
  const cls = [styles.clock, running && styles.clockActive, ms < LOW_MS && styles.clockLow].filter(Boolean).join(' ');
  // role=timer is announced on focus only (aria-live off), so screen readers are not spammed every tenth of a second.
  return (
    <span className={cls} role="timer" aria-live="off" aria-label={`${color === 'w' ? 'White' : 'Black'} clock ${text}`}>
      {text}
    </span>
  );
}
