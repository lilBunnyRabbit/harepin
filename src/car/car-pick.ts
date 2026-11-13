import { SLOT_NAMES, build_code, build_spec, parse_build, type Build } from "./build";
import type { SavedBuild } from "./builds";
import { CARS, car_sized } from "./cars";
import { CLASS_FLOORS, CLASS_LABELS, rating, type CarClass, type Rating } from "./pi";
import { PRESETS } from "./presets";

export interface CarLimit {
  cap: CarClass | null;
  car_sized_only: boolean;
  /** Car ids the route leaves out. */
  excludes?: readonly string[];
}

export interface CarChoice {
  title: string;
  sub: string;
  code: string;
  rating: Rating;
  fitted: boolean;
  blocked: string | null;
  /** Under a class cap: the strongest car it allows, ties included. */
  recommended: boolean;
}

export interface CarShelf {
  head: string;
  choices: CarChoice[];
}

const rank = (name: CarClass) => CLASS_FLOORS.findIndex(([floor]) => floor === name);

export const within = (name: CarClass, cap: CarClass) => rank(name) <= rank(cap);

// Paint, decal, ink and number change the look only: the same body and parts drive the same.
export const same_machine = (a: Build, b: Build) => a.car === b.car && SLOT_NAMES.every((slot) => a.parts[slot] === b.parts[slot]);

export const limit_text = (cap: CarClass) => `Class ${CLASS_LABELS[cap]} or below`;

function blocked(build: Build, rated: Rating, limit: CarLimit): string | null {
  if (limit.cap && !within(rated.class, limit.cap)) return `Over ${CLASS_LABELS[limit.cap]}`;
  if (limit.car_sized_only && !car_sized(build_spec(build))) return "Too big for this mode";
  if (limit.excludes?.includes(build.car)) return "Not raced in this car";
  return null;
}

// Cars the limit rules out stay listed, greyed with their badge, so the player sees what to change in the garage.
export function car_shelves(current: Build, builds: readonly SavedBuild[], limit: CarLimit): CarShelf[] {
  const fitted = build_code(current);
  const choice = (title: string, sub: string, build: Build): CarChoice => {
    const rated = rating(build);
    const code = build_code(build);
    return { title, sub, code, rating: rated, fitted: code === fitted, blocked: blocked(build, rated, limit), recommended: false };
  };
  const parsed = (list: readonly { name: string; code: string }[], sub: (build: Build, i: number) => string) =>
    list.flatMap((entry, i) => {
      const build = parse_build(entry.code);
      return build ? [choice(entry.name, sub(build, i), build)] : [];
    });
  const shelves: CarShelf[] = [
    { head: "Your car", choices: [choice(CARS[current.car].name, "Your own car", current)] },
    { head: "My builds", choices: parsed(builds, (build) => CARS[build.car].name) },
    { head: "Presets", choices: parsed(PRESETS, (_, i) => PRESETS[i].blurb) },
  ];
  if (limit.cap) {
    const open = shelves.flatMap((shelf) => shelf.choices).filter((c) => c.blocked === null);
    const top = Math.max(...open.map((c) => c.rating.pi));
    for (const c of open) c.recommended = c.rating.pi === top;
  }
  return shelves.filter((shelf) => shelf.choices.length);
}
