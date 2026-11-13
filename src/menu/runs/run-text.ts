import { limit_text } from "../../car/car-pick";
import { type_of, type RunCar, type RunPick } from "../../runs/runs";
import type { WorldKind } from "../../worldgen/types";
import { WORLDS } from "../../worlds/worlds";

export const world_name = (kind: WorldKind) => WORLDS[kind].name;

export const car_text = (car: RunCar) => ("cap" in car ? limit_text(car.cap) : `${car.preset} car`);

export const pick_text = (pick: RunPick) => `${type_of(pick.type).name} · ${world_name(pick.kind)}`;

export function run_link(pick: RunPick): string {
  return `${location.origin}${location.pathname}?${new URLSearchParams({ run: pick.id })}`;
}

export const star_text = (got: number, max = 3) => ({ on: "★".repeat(got), off: "★".repeat(Math.max(0, max - got)) });
