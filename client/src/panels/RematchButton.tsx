import { useGame } from '../game/GameContext';

export function RematchButton({ onRematch }: { onRematch: () => void }) {
  const { state, dispatch } = useGame();
  const { mine, theirs } = state.rematch;
  const label = mine ? 'Waiting for opponent…' : theirs ? 'Accept rematch' : 'Rematch';
  return (
    <button
      className={`btn ${theirs && !mine ? 'btn-primary' : ''}`}
      disabled={mine || !state.opponentOnline}
      onClick={() => {
        dispatch({ type: 'REMATCH_REQUESTED' });
        onRematch();
      }}
    >
      {label}
    </button>
  );
}
