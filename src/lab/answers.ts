import type { Answers } from "./export";
import type { Pack, Question, Trial } from "./pack";

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;
/** A note is one line; a paste longer than this is cut, not refused. */
export const TEXT_MAX = 400;

export const questions_of = (pack: Pack, trial: Trial): readonly Question[] => trial.ask ?? pack.ask;

/** Per pack and rev: answers given to an older rev rate a different pack. */
export const answers_key = (pack: Pack) => `harepin.lab.${pack.id}.r${pack.rev}`;

export function answer_of(question: Question, value: unknown): string | number | null {
  if (question.kind === "scale") return Number.isInteger(value) && (value as number) >= SCALE_MIN && (value as number) <= SCALE_MAX ? (value as number) : null;
  if (typeof value !== "string") return null;
  if (question.kind === "pick") return question.options.includes(value) ? value : null;
  const text = value.slice(0, TEXT_MAX);
  return text.trim() ? text : null;
}

/** Stored answers are untrusted: only known trials and questions with values they take survive. */
export function read_answers(pack: Pack, raw: unknown): Answers {
  const out: Answers = {};
  if (typeof raw !== "object" || raw === null) return out;
  const given = raw as Record<string, unknown>;
  for (const trial of pack.trials) {
    const row = given[trial.id];
    if (typeof row !== "object" || row === null) continue;
    for (const question of questions_of(pack, trial)) {
      const value = answer_of(question, (row as Record<string, unknown>)[question.id]);
      if (value !== null) (out[trial.id] ??= {})[question.id] = value;
    }
  }
  return out;
}
