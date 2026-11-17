import { parse_build } from "../car/build";
import { STRIDE, is_lap } from "../car/ghost-cap";
import type { Watched } from "./run-tape";

export const REPLAYS_PAGE = "replays";
export const MAX_REPLAYS = 6;
/** Numbers one replay may hold: a ten minute run with six AI cars is 336 000. */
export const MAX_REPLAY_NUMBERS = 400_000;
/** Numbers every saved replay may hold together, about 8 MB: past it the oldest go. */
export const MAX_SAVED_NUMBERS = 1_000_000;
export const MAX_TEXT = 80;

export interface SavedCar {
  /** A build code. */
  car: string;
  lap: number[];
}

export interface SavedReplay {
  id: string;
  at: number;
  name: string;
  mode: string;
  /** The map's code: a replay plays only on the map it was driven on. */
  map: string;
  place: string;
  car: string;
  lap: number[];
  field: SavedCar[];
}

export interface ReplayMeta {
  id: string;
  at: number;
  name: string;
  mode: string;
  map: string;
  place: string;
  car: string;
  /** In the tape's order. */
  cars: readonly string[];
}

const rounded = (lap: readonly number[]) => lap.map((v) => Math.round(v * 1000) / 1000);

/** A copy of the tape as it is saved; an AI car that never took a frame is left out. */
export function pack_replay(tape: Watched, { cars, ...meta }: ReplayMeta): SavedReplay {
  const field = tape.field.flatMap((lap, i) => (lap.length && cars[i] !== undefined ? [{ car: cars[i], lap: rounded(lap) }] : []));
  // Clipped to what `parse_replay` reads back: a name too long must not cost the replay.
  return { ...meta, name: meta.name.slice(0, MAX_TEXT), mode: meta.mode.slice(0, MAX_TEXT), place: meta.place.slice(0, MAX_TEXT), lap: rounded(tape.frames), field };
}

export function replay_numbers(replay: SavedReplay): number {
  return replay.field.reduce((sum, car) => sum + car.lap.length, replay.lap.length);
}

export function watched(replay: SavedReplay): Watched {
  return { frames: replay.lap, field: replay.field.map((car) => car.lap), end_ms: replay.lap[replay.lap.length - STRIDE] };
}

const text = (value: unknown): value is string => typeof value === "string" && value.length <= MAX_TEXT;

function saved_car(value: unknown): SavedCar | null {
  if (typeof value !== "object" || value === null || !("car" in value) || !("lap" in value)) return null;
  const { car, lap } = value;
  return typeof car === "string" && parse_build(car) && is_lap(lap) ? { car, lap } : null;
}

export function parse_replay(value: unknown): SavedReplay | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, at, name, mode, map, place, car, lap, field } = value as Record<string, unknown>;
  if (!text(id) || !id || !text(name) || !text(mode) || !text(map) || !text(place) || !text(car)) return null;
  if (typeof at !== "number" || !Number.isFinite(at) || !is_lap(lap) || !(lap[lap.length - STRIDE] > 0) || !Array.isArray(field)) return null;
  const cars: SavedCar[] = [];
  for (const one of field) {
    const parsed = saved_car(one);
    if (!parsed) return null;
    cars.push(parsed);
  }
  const replay: SavedReplay = { id, at, name, mode, map, place, car, lap, field: cars };
  return replay_numbers(replay) <= MAX_REPLAY_NUMBERS ? replay : null;
}

/** `replays` newest first, split at the caps: the newest always keeps, however big. */
export function capped(replays: readonly SavedReplay[]): { keep: SavedReplay[]; drop: SavedReplay[] } {
  const sorted = [...replays].sort((a, b) => b.at - a.at);
  let numbers = 0;
  let count = 0;
  for (const replay of sorted) {
    numbers += replay_numbers(replay);
    if (count && (count >= MAX_REPLAYS || numbers > MAX_SAVED_NUMBERS)) break;
    count++;
  }
  return { keep: sorted.slice(0, count), drop: sorted.slice(count) };
}
