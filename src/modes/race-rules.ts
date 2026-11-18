import { CutCheck, LineMeasure, track_side, type LimitsCar, type LimitsGround } from "./track-limits";
import type { RoutePoint } from "./route";
import { hypot } from "../sim-math";

export interface LimitRules {
  warnings: number;
  penalty_ms: number;
}

export interface RaceRules {
  limits: LimitRules | null;
  /** ms facing back down the route before the car is put back on its last gate; null never. */
  wrong_way_ms: number | null;
}

export const RACE_RULES: RaceRules = { limits: { warnings: 2, penalty_ms: 2000 }, wrong_way_ms: 5000 };
// A trail has no edge to keep inside: open dirt is the course.
export const TRAIL_RULES: RaceRules = { limits: null, wrong_way_ms: 5000 };
export const NO_RULES: RaceRules = { limits: null, wrong_way_ms: null };

export interface RulesCar extends LimitsCar {
  readonly pos: { readonly x: number; readonly z: number };
  readonly vel: { readonly x: number; readonly z: number };
}

export class Stewards {
  private readonly check: CutCheck | null;
  private readonly measure: LineMeasure;
  private wrong = 0;
  penalty_ms = 0;

  constructor(
    readonly rules: RaceRules,
    line: readonly RoutePoint[],
    half: number,
  ) {
    this.measure = new LineMeasure(line);
    this.check = rules.limits ? new CutCheck(this.measure, half) : null;
  }

  get cuts(): number {
    return this.check?.cuts ?? 0;
  }

  /** `lap` 0 the first, `index` the line point nearest the car, `dt` s. The toast for a cut made this frame, else null. */
  limits(car: RulesCar, ground: LimitsGround, lap: number, index: number, dt: number): string | null {
    const { check } = this;
    const limits = this.rules.limits;
    if (!check || !limits || index < 0) return null;
    const s = this.measure.at(lap, index, car.pos.x, car.pos.z);
    return check.update(track_side(car, ground), s, car.pos.x, car.pos.z, hypot(car.vel.x, car.vel.z), dt) ? this.call(limits) : null;
  }

  /** As the run's last lap ends: a cut still under way counts up to the line. */
  settle(car: RulesCar, lap: number, index: number): string | null {
    const { check } = this;
    const limits = this.rules.limits;
    if (!check || !limits || index < 0) return null;
    return check.settle(this.measure.at(lap, index, car.pos.x, car.pos.z)) ? this.call(limits) : null;
  }

  private call(limits: LimitRules): string {
    const cuts = this.cuts;
    if (cuts <= limits.warnings) return `Track limits · warning ${cuts}/${limits.warnings}`;
    this.penalty_ms += limits.penalty_ms;
    return `Track limits · +${limits.penalty_ms / 1000} s`;
  }

  wrong_way(wrong: boolean, dt_ms: number): boolean {
    const most = this.rules.wrong_way_ms;
    this.wrong = wrong && most !== null ? this.wrong + dt_ms : 0;
    if (most === null || this.wrong < most) return false;
    this.wrong = 0;
    this.check?.reset();
    return true;
  }
}
