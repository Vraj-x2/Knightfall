import { Link, useParams } from 'react-router-dom';
import { GameProvider } from '../game/GameContext';
import { useRoomSocket } from '../net/useRoomSocket';
import { GameScreen } from './GameScreen';
import styles from './Pages.module.css';

export default function Game() {
  const { roomId = '' } = useParams();
  return (
    <GameProvider key={roomId} roomId={roomId}>
      <OnlineGame roomId={roomId} />
    </GameProvider>
  );
}

function OnlineGame({ roomId }: { roomId: string }) {
  const { send, error } = useRoomSocket(roomId);

  if (error) {
    return (
      <main className={styles.center}>
        <h1>{error === 'ROOM_FULL' ? 'This game is full' : 'Game not found'}</h1>
        <Link to="/">Start a new game</Link>
      </main>
    );
  }

  return (
    <GameScreen
      actions={{
        onMove: ({ from, to, promotion, ply }) => send({ type: 'move', from, to, promotion, ply }),
        onResign: () => send({ type: 'resign' }),
        onRematch: () => send({ type: 'rematch' }),
        onRename: (name) => send({ type: 'set_name', name }),
      }}
    />
  );
}
