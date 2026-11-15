import { curve_at } from "./curve";

/** A turbo's boost over the stock torque curve: none below `lag` rpm, a smooth ramp to `peak` times stock at `spool` rpm and on. */
export interface Boost {
  peak: number;
  lag: number;
  spool: number;
}

// The reshaped table is read by the same linear `curve_at` as stock, so a step this fine keeps the ramp's S shape.
const STEP_RPM = 500;

export function boost_at(boost: Boost, rpm: number): number {
  const t = Math.max(0, Math.min(1, (rpm - boost.lag) / (boost.spool - boost.lag)));
  return 1 + (boost.peak - 1) * t * t * (3 - 2 * t);
}

/** Built once per resolved spec, never in the step. The stock breakpoints stay in the grid so no torque peak is shaved. */
export function boosted(torque: readonly (readonly [number, number])[], boost: Boost): [number, number][] {
  const end = torque[torque.length - 1][0];
  const rpms = new Set(torque.map(([rpm]) => rpm));
  for (let rpm = 0; rpm < end; rpm += STEP_RPM) rpms.add(rpm);
  return [...rpms].sort((a, b) => a - b).map((rpm) => [rpm, Math.round(curve_at(torque, rpm) * boost_at(boost, rpm))]);
}
