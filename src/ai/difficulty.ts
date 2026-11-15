import type { Personality } from "./driver";

export const Difficulty = {
  EASY: "easy",
  NORMAL: "normal",
  HARD: "hard",
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

/** Factors on each car's drawn `pace` and `mistakes` (O5). */
interface Scale {
  pace: number;
  mistakes: number;
}

const DIFFICULTY: Record<Difficulty, Scale> = {
  easy: { pace: 0.9, mistakes: 1.5 },
  normal: { pace: 1, mistakes: 1 },
  hard: { pace: 1.02, mistakes: 0.5 },
};

export function at_difficulty(traits: readonly Personality[], difficulty: Difficulty): Personality[] {
  const { pace, mistakes } = DIFFICULTY[difficulty];
  return traits.map((t) => ({ ...t, pace: t.pace * pace, mistakes: Math.min(1, t.mistakes * mistakes) }));
}
