import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { findLevel, type Level } from '../engine/levels';
import { useEngineGame } from '../engine/useEngineGame';
import { GameProvider } from '../game/GameContext';
import type { Color } from '../net/protocol';
import { GameScreen } from './GameScreen';
import styles from './Pages.module.css';

export default function Solo() {
  const [params] = useSearchParams();
  const level = findLevel(params.get('level'));
  // Random is decided once per visit, so re-renders can't flip your colour mid-game.
  const [color] = useState<Color>(() => { const c = params.get('color'); return c === 'b' || (c === 'random' && Math.random() < 0.5) ? 'b' : 'w'; });
  return (
    <GameProvider roomId="solo">
      <SoloGame level={level} color={color} />
    </GameProvider>
  );
}

function SoloGame({ level, color }: { level: Level; color: Color }) {
  const { error, resign, rematch } = useEngineGame(level, color);

  if (error) {
    return (
      <main className={styles.center}>
        <h1>The computer opponent couldn&apos;t start</h1>
        <p className={styles.error}>{error}</p>
        <Link to="/">Back to the lobby</Link>
      </main>
    );
  }

  return <GameScreen actions={{ solo: true, onMove: () => true, onResign: resign, onRematch: rematch }} />;
}
