import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TimeControl } from '../net/protocol';
import { LEVELS, DEFAULT_LEVEL } from '../engine/levels';
import { EngineCredit } from '../panels/EngineCredit';
import { createRoom, loadName, MAX_NAME_LENGTH, saveName } from '../net/socket';
import { AppHeader, LogoMark } from '../brand/Logo';
import { ChipGroup } from './ChipGroup';
import styles from './Lobby.module.css';

// Value is "base+increment" in seconds; the server re-validates whatever it receives.
const TIME_CONTROLS = [
  { value: '', label: '∞', hint: 'Untimed' },
  { value: '60+0', label: '1+0', hint: 'Bullet' },
  { value: '180+0', label: '3+0', hint: 'Blitz' },
  { value: '180+2', label: '3+2', hint: 'Blitz' },
  { value: '300+0', label: '5+0', hint: 'Blitz' },
  { value: '600+0', label: '10+0', hint: 'Rapid' },
  { value: '900+10', label: '15+10', hint: 'Rapid' },
];

function toTimeControl(value: string): TimeControl | undefined {
  if (!value) return undefined;
  const [base, increment] = value.split('+').map(Number);
  return { base, increment };
}

export default function Lobby() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(loadName);
  const [control, setControl] = useState('');
  const [level, setLevel] = useState(DEFAULT_LEVEL.id);
  const [color, setColor] = useState('w');

  async function create() {
    setBusy(true);
    setError(null);
    try {
      navigate(`/g/${await createRoom(toTimeControl(control))}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main className={styles.lobby}>
        <section className={styles.hero}>
          <LogoMark size={72} />
          <h1 className={styles.title}>Play chess, instantly.</h1>
          <p className={styles.tagline}>No sign-up. Create a room, share the link, and you&apos;re playing in seconds.</p>
          <input
            className={styles.nameField}
            aria-label="Your name (optional)"
            placeholder="Your name (optional)"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => {
              setName(e.target.value);
              saveName(e.target.value.trim());
            }}
          />
        </section>

        <div className={styles.cards}>
          <section className={styles.card} aria-labelledby="friend-title">
            <div className={styles.cardHead}>
              <span className={styles.cardIcon} aria-hidden="true">♞</span>
              <div>
                <h2 id="friend-title">Play a friend</h2>
                <p>Real-time over a shareable link</p>
              </div>
            </div>
            <ChipGroup label="Time control" options={TIME_CONTROLS} value={control} onChange={setControl} />
            <button className="btn btn-primary btn-block" onClick={create} disabled={busy}>
              {busy ? 'Creating…' : 'Create game'}
            </button>
            {error && <p className={styles.error} role="alert">{error}</p>}
          </section>

          <section className={styles.card} aria-labelledby="cpu-title">
            <div className={styles.cardHead}>
              <span className={`${styles.cardIcon} ${styles.cardIconAlt}`} aria-hidden="true">♜</span>
              <div>
                <h2 id="cpu-title">Play the computer</h2>
                <p>Practice against Stockfish</p>
              </div>
            </div>
            <ChipGroup
              label="Difficulty"
              options={LEVELS.map((l) => ({ value: l.id, label: l.label }))}
              value={level}
              onChange={setLevel}
            />
            <ChipGroup label="Your colour" options={COLORS} value={color} onChange={setColor} />
            <button className="btn btn-block" onClick={() => navigate(`/solo?level=${level}&color=${color}`)}>
              Play computer
            </button>
          </section>
        </div>
        <EngineCredit />
      </main>
    </>
  );
}

const COLORS = [
  { value: 'w', label: '♔ White' },
  { value: 'random', label: '⚄ Random' },
  { value: 'b', label: '♚ Black' },
];
