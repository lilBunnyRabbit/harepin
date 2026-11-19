import type { CarLocks } from "../car/car-pick";
import { BODIES, FRAMES, type CarId, type FrameId } from "../car/cars";
import { TIERS, type Tier } from "./career";
import type { Season } from "./series";
import { CUPS } from "./series-seasons";

export const frame_of = (car: CarId): FrameId => BODIES[car].frame;

export const FRAME_CUPS: Readonly<Partial<Record<FrameId, Season>>> = Object.fromEntries(CUPS.flatMap((cup) => (cup.loaner ? [[frame_of(cup.loaner), cup]] : [])));

const FRAME_TIERS: Readonly<Partial<Record<FrameId, Tier>>> = Object.fromEntries(TIERS.flatMap((tier) => (tier.rewards.car ? [[frame_of(tier.rewards.car), tier]] : [])));

export const STARTER_FRAMES: readonly FrameId[] = (Object.keys(FRAMES) as FrameId[]).filter((frame) => !FRAME_CUPS[frame] && !FRAME_TIERS[frame]);

const BODY_IDS = Object.keys(BODIES) as CarId[];

export function lock_line(frame: FrameId): string | null {
  const cup = FRAME_CUPS[frame];
  if (cup) return `Finish the ${cup.name} to own it`;
  const tier = FRAME_TIERS[frame];
  return tier ? `Win the ${tier.name} final to own it` : null;
}

/** `cars`: the ones the player was given, by the wallet or a career tier; any body on a frame owns the frame. */
export function owned_frames(cars: readonly CarId[]): Set<FrameId> {
  return new Set([...STARTER_FRAMES, ...cars.map(frame_of)]);
}

export function frame_locks(cars: readonly CarId[]): CarLocks {
  const owned = owned_frames(cars);
  return Object.fromEntries(BODY_IDS.flatMap((car) => (owned.has(frame_of(car)) ? [] : [[car, lock_line(frame_of(car)) ?? ""]])));
}
