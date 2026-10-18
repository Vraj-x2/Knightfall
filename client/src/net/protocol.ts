// Contract with server/index.js. Keep both sides in sync.
export type Color = 'w' | 'b';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export type MoveRecord = { from: string; to: string; promotion?: string; san: string };
export type GameResult = { winner: Color | null; reason: string };
// Remaining milliseconds per side as of the moment the server sent it. `running` is the side being timed.
export type ClockSnapshot = { w: number; b: number; running: Color | null; baseMs: number; incMs: number };
export type TimeControl = { base: number; increment: number }; // seconds
export type RematchState = { mine: boolean; theirs: boolean };
export type ErrorCode = 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'BAD_MESSAGE' | 'RATE_LIMIT';

export type ClientMessage =
  | { type: 'create'; timeControl?: TimeControl }
  | { type: 'join'; roomId: string; token?: string; name?: string }
  | { type: 'move'; from: string; to: string; promotion?: string; ply: number }
  | { type: 'resign' }
  | { type: 'set_name'; name: string }
  | { type: 'rematch' }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'created'; roomId: string; color: Color; token: string }
  | {
      type: 'joined';
      roomId: string;
      color: Color;
      token: string;
      moves: MoveRecord[];
      opponentOnline: boolean;
      opponentName: string;
      clock: ClockSnapshot | null;
      result: GameResult | null;
      rematch: RematchState;
    }
  | { type: 'opponent_joined'; name: string }
  | ({ type: 'move'; ply: number; clock?: ClockSnapshot | null } & MoveRecord)
  | { type: 'rejected'; reason: string; moves: MoveRecord[] }
  | { type: 'opponent_left' }
  | { type: 'opponent_back'; name: string }
  | { type: 'opponent_name'; name: string }
  | { type: 'rematch_offered' }
  | { type: 'rematch_started'; color: Color; clock?: ClockSnapshot | null }
  | ({ type: 'game_over'; clock?: ClockSnapshot | null } & GameResult)
  | { type: 'error'; code: ErrorCode }
  | { type: 'pong' };
