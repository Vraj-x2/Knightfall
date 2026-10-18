import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../brand/Logo';
import { Board } from '../board/Board';
import { CommentaryPanel } from '../commentary/CommentaryPanel';
import { PromotionPicker } from '../board/PromotionPicker';
import { useGame } from '../game/GameContext';
import {
  canMove,
  checkedKingSquare,
  findLegalMove,
  isPromotionMove,
  lastMoveSquares,
  legalMovesFrom,
} from '../game/selectors';
import { useMoveFeedback } from '../game/useMoveFeedback';
import type { PromotionPiece } from '../net/protocol';
import { loadName, saveName } from '../net/socket';
import { EngineCredit } from '../panels/EngineCredit';
import { MoveList } from '../panels/MoveList';
import { PlayerBar } from '../panels/PlayerBar';
import { RematchButton } from '../panels/RematchButton';
import { Resign } from '../panels/Resign';
import { ShareLink } from '../panels/ShareLink';
import { SoundToggle } from '../panels/SoundToggle';
import { StatusBar } from '../panels/StatusBar';
import styles from './Pages.module.css';

// What the screen needs from whoever is running the game: a server over a socket, or a local engine.
export type GameActions = {
  onMove: (move: { from: string; to: string; promotion?: PromotionPiece; ply: number }) => boolean; // false: could not be sent
  onResign: () => void;
  onRematch: () => void;
  onRename?: (name: string) => void;
  solo?: boolean;
};

export function GameScreen({ actions }: { actions: GameActions }) {
  const { state, dispatch, game, viewGame, shownMoves } = useGame();
  const skipSlide = useRef(false);
  const [myName, setMyName] = useState(loadName);
  const animatedPly = useMoveFeedback(state, skipSlide);
  const { myColor, selected, pendingPromotion } = state;
  const interactive = canMove(state, game);
  const targets = selected ? legalMovesFrom(game, selected) : [];

  const isMine = (square: string) => game.get(square as never)?.color === myColor;

  // A dragged piece already sits where it was dropped, so it should not slide again.
  function commit(from: string, to: string, promotion?: PromotionPiece, viaDrop = false) {
    const legal = findLegalMove(game, from, to, promotion);
    if (!legal) return dispatch({ type: 'DESELECT' });
    const ply = state.moves.length;
    skipSlide.current = viaDrop;
    dispatch({ type: 'LOCAL_MOVE', move: { from, to, promotion, san: legal.san } });
    if (!actions.onMove({ from, to, promotion, ply })) {
      dispatch({ type: 'SERVER_SYNC', moves: state.moves });
    }
  }

  function attemptMove(from: string, to: string, viaDrop = false) {
    if (!interactive) return;
    if (isPromotionMove(game, from, to)) dispatch({ type: 'START_PROMOTION', from, to });
    else commit(from, to, undefined, viaDrop);
  }

  function onTap(square: string) {
    if (!interactive) return;
    if (selected && targets.some((m) => m.to === square)) attemptMove(selected, square);
    else if (isMine(square) && square !== selected) dispatch({ type: 'SELECT', square });
    else dispatch({ type: 'DESELECT' });
  }

  function rename(name: string) {
    saveName(name);
    setMyName(name);
    actions.onRename?.(name);
  }

  const gameLive = !state.result && state.connection === 'open' && state.opponentOnline;
  const orientation = myColor ?? 'w';
  const opponent = orientation === 'w' ? 'b' : 'w';
  const slideKey = animatedPly !== null && animatedPly === shownMoves.length ? String(animatedPly) : null;

  return (
    <>
    <AppHeader>
      <SoundToggle />
      <Link className="btn" to="/">New game</Link>
    </AppHeader>
    <main className={styles.game}>
      <div className={styles.boardColumn}>
        <StatusBar />
        <PlayerBar color={opponent} name={state.opponentName} />
        <div className={styles.boardWrap}>
          <Board
            game={viewGame}
            orientation={orientation}
            selected={selected}
            targets={targets}
            lastMove={lastMoveSquares(shownMoves)}
            slideKey={slideKey}
            checkSquare={checkedKingSquare(viewGame)}
            canDrag={(sq) => interactive && isMine(sq)}
            onDragStart={(square) => dispatch({ type: 'SELECT', square })}
            onDrop={(from, to) => attemptMove(from, to, true)}
            onTap={onTap}
            onCancel={() => dispatch({ type: 'DESELECT' })}
          />
          {pendingPromotion && myColor && (
            <PromotionPicker
              color={myColor}
              onPick={(piece) => commit(pendingPromotion.from, pendingPromotion.to, piece)}
              onCancel={() => dispatch({ type: 'CANCEL_PROMOTION' })}
            />
          )}
        </div>
        <PlayerBar color={orientation} name={myName} editable onRename={rename} />
      </div>
      <aside className={styles.sidePanel}>
        <div className={styles.actions}>
          {!actions.solo && <ShareLink />}
          {gameLive && <Resign onResign={actions.onResign} />}
          {state.result && <RematchButton onRematch={actions.onRematch} />}
        </div>
        <CommentaryPanel names={orientation === 'w' ? { w: myName, b: state.opponentName } : { w: state.opponentName, b: myName }} />
        <MoveList />
        {actions.solo && <EngineCredit />}
      </aside>
    </main>
    </>
  );
}
