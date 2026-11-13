import { SLOT_NAMES, build_code, build_spec, parse_build, type Build } from "./build";
import type { SavedBuild } from "./builds";
import { CARS, car_sized } from "./cars";
import { CLASS_FLOORS, CLASS_LABELS, rating, type CarClass, type Rating } from "./pi";
import type { Preset } from "./presets";

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
  build: Build;
  rating: Rating;
  fitted: boolean;
  /** The player's own car, the one the garage saved. */
  own: boolean;
  blocked: string | null;
  /** Under a class cap: the one car to take, the strongest it allows; a tie goes to the player's own, then the fitted one. */
  recommended: boolean;
}

/** One class's cars; `open` when the limit lets any of them in. */
export interface CarShelf {
  class: CarClass;
  head: string;
  open: boolean;
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
  if (limit.excludes?.includes(build.car)) return `${CARS[build.car].name} can't race here`;
  return null;
}

// One shelf per class that has a car, strongest first, with the classes the limit lets in ahead of the rest. Cars the
// limit rules out stay listed, greyed with their badge, so the player sees what to change in the garage.
/** `presets`: the ones this player may pick. `fitted`: the code of the car on now, which mid-event is the event's car rather than `current`, the player's own. */
export function car_shelves(current: Build, builds: readonly SavedBuild[], presets: readonly Preset[], limit: CarLimit, fitted = build_code(current)): CarShelf[] {
  const choice = (title: string, sub: string, build: Build, own = false): CarChoice => {
    const rated = rating(build);
    const code = build_code(build);
    return { title, sub, code, build, rating: rated, fitted: code === fitted, own, blocked: blocked(build, rated, limit), recommended: false };
  };
  const parsed = (list: readonly { name: string; code: string }[], sub: (build: Build, i: number) => string) =>
    list.flatMap((entry, i) => {
      const build = parse_build(entry.code);
      return build ? [choice(entry.name, sub(build, i), build)] : [];
    });
  const listed = [choice(CARS[current.car].name, "", current, true), ...parsed(builds, (build) => CARS[build.car].name), ...parsed(presets, (_, i) => presets[i].blurb)];
  // A saved build or preset the player already drives is their own car's tile, not a second one.
  const all = listed.filter((c, i) => listed.findIndex((other) => other.code === c.code) === i);
  if (limit.cap) {
    const open = all.filter((c) => c.blocked === null);
    const top = Math.max(...open.map((c) => c.rating.pi));
    const best = open.filter((c) => c.rating.pi === top);
    const pick = best.find((c) => c.own) ?? best.find((c) => c.fitted) ?? best[0];
    if (pick) pick.recommended = true;
  }
  const shelves = [...CLASS_FLOORS]
    .reverse()
    .map(([name]): CarShelf => {
      const choices = all.filter((c) => c.rating.class === name).sort((a, b) => Number(a.blocked !== null) - Number(b.blocked !== null) || Number(b.own) - Number(a.own) || b.rating.pi - a.rating.pi);
      return { class: name, head: `Class ${CLASS_LABELS[name]}`, open: choices.some((c) => c.blocked === null), choices };
    })
    .filter((shelf) => shelf.choices.length);
  // Closed classes nearest the cap first: the one a small garage change would open comes next to the open ones.
  return [...shelves.filter((shelf) => shelf.open), ...shelves.filter((shelf) => !shelf.open).reverse()];
}
