import { limit_text } from "../../car/car-pick";
import { MODES } from "../../modes/modes";
import { points_text } from "../../modes/result";
import { format } from "../../hud/hud";
import { type_of, type Resolved, type RunCar, type RunPick, type RunType } from "../../runs/runs";
import { RewardKind, tint_label, title_text, type SeasonReward } from "../../runs/season";
import type { WorldKind } from "../../worldgen/types";
import { WORLDS } from "../../worlds/worlds";

export const world_name = (kind: WorldKind) => WORLDS[kind].name;

export const car_text = (car: RunCar) => ("cap" in car ? limit_text(car.cap) : `${car.preset} car`);

/** A weekly stage as the Runs row names it: its type, or the circuit race standing in where the map has none. */
export function stage_text(type: RunType, resolved: Resolved | undefined): string {
  const name = type_of(type).name;
  return resolved?.fallback ? `Race (no ${name.toLowerCase()} here)` : name;
}

export const pick_text = (pick: RunPick) => `${type_of(pick.type).name} · ${world_name(pick.kind)}`;

export function run_link(pick: RunPick): string {
  return `${location.origin}${location.pathname}?${new URLSearchParams({ run: pick.id })}`;
}

export const star_text = (got: number, max = 3) => ({ on: "★".repeat(got), off: "★".repeat(Math.max(0, max - got)) });

export const reward_text = (reward: SeasonReward) => (reward.kind === RewardKind.TINT ? `${tint_label(reward.id)} tint` : reward.label);

/** A kept reward code as the player reads it: `S1 Ace`, `Info tint`. */
export const code_text = (code: string) => title_text(code) ?? `${tint_label(code)} tint`;

/** A daily board entry in its mode's own unit: km/h, metres or points when it scores, else its time. */
export function daily_text(mode: string, { ms, score }: { ms: number; score?: number }): string {
  if (score === undefined) return format(ms);
  return (MODES.find((m) => m.id === mode)?.score_text ?? points_text)(score);
}
