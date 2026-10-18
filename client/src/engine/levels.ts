// Strength presets: Stockfish's "Skill Level" option (0-20) plus how long it may think per move.
export type Level = { id: string; label: string; skill: number; movetimeMs: number };

export const LEVELS: Level[] = [
  { id: 'beginner', label: 'Beginner', skill: 1, movetimeMs: 150 },
  { id: 'casual', label: 'Casual', skill: 5, movetimeMs: 300 },
  { id: 'strong', label: 'Strong', skill: 12, movetimeMs: 800 },
  { id: 'max', label: 'Maximum', skill: 20, movetimeMs: 1500 },
];

export const DEFAULT_LEVEL = LEVELS[1];

export const findLevel = (id: string | null): Level => LEVELS.find((l) => l.id === id) ?? DEFAULT_LEVEL;
