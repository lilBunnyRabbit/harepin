import { MAX_STARS, type Thresholds } from "./track";

export interface Stage {
  readonly mode: string;
  readonly level: string;
  readonly name?: string;
  /** Its marks on the event's `tuned` map, as an event's own `stars`; the mode's marks grade it when absent. */
  readonly stars?: Thresholds;
}

/** The id a championship's best total keeps in its event store, beside each stage's level. */
export const CUP_RECORD = "cup";
export const MIN_STAGES = 3;
export const MAX_STAGES = 5;
/** Points by a stage's stars (career.md §10.3, proposed): 1★ 3, 2★ 6, 3★ 10. */
export const STAGE_POINTS: readonly number[] = [0, 3, 6, 10];
const MAX_POINTS = STAGE_POINTS[MAX_STARS];
// Default marks, as shares of every stage on 3★: 3★ takes mostly golds, 2★ about a silver each.
const GOLD_SHARE = 0.8;
const SILVER_SHARE = 0.5;

export const stage_points = (stars: number): number => STAGE_POINTS[Math.max(0, Math.min(MAX_STARS, stars))] ?? 0;

export function cup_marks(stages: number): Thresholds {
  const max = stages * MAX_POINTS;
  return { two: Math.round(max * SILVER_SHARE), three: Math.round(max * GOLD_SHARE) };
}

// Any points at all earn the one star: a 0-star stage scores nothing.
export function cup_stars(total: number, { two, three }: Thresholds): number {
  if (total >= three) return MAX_STARS;
  if (total >= two) return 2;
  return total > 0 ? 1 : 0;
}

export const cup_status = (index: number, stages: number, total: number) => `Stage ${index + 1}/${stages} · ${total} pts`;

/** A championship under way: the stage being run and each stage's best stars, a retry keeping the better one. */
export class Cup {
  private readonly best: (number | null)[];
  private index_ = 0;

  constructor(
    readonly stages: readonly Stage[],
    readonly marks: Thresholds = cup_marks(stages.length),
  ) {
    this.best = stages.map(() => null);
  }

  get index(): number {
    return this.index_;
  }

  get stage(): Stage {
    return this.stages[this.index_];
  }

  get results(): readonly (number | null)[] {
    return this.best;
  }

  get total(): number {
    return this.best.reduce<number>((sum, stars) => sum + stage_points(stars ?? 0), 0);
  }

  /** The last stage has a result: the total stands, and Next leaves the championship. */
  get done(): boolean {
    return this.index_ === this.stages.length - 1 && this.best[this.index_] !== null;
  }

  /** 0 until done, and 0 when any stage finished without a star (career.md §10.9 Q4, decided). */
  get stars(): number {
    if (!this.done || this.best.some((stars) => (stars ?? 0) < 1)) return 0;
    return cup_stars(this.total, this.marks);
  }

  get status(): string {
    return cup_status(this.index_, this.stages.length, this.total);
  }

  score(stars: number) {
    this.best[this.index_] = Math.max(stars, this.best[this.index_] ?? 0);
  }

  advance(): boolean {
    if (this.best[this.index_] === null || this.index_ + 1 >= this.stages.length) return false;
    this.index_++;
    return true;
  }
}
