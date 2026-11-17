import type { CarChoice, CarShelf } from "../car/car-pick";
import { tier_of, type CareerEvent } from "./career";

export const ROW_CARS = 5;

export interface Mark {
  stars: number;
  text: string;
}

const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Drift and championships grade on points, where the three-star mark sits above the two-star one.
function mark_text(event: CareerEvent, value: number): string {
  const scored = event.stages !== undefined || (event.stars !== undefined && event.stars.three > event.stars.two);
  return scored ? `${Math.round(value)} pts` : clock(value);
}

export function marks_of(event: CareerEvent): Mark[] {
  const { stars } = event;
  const finish = { stars: 1, text: "Finish" };
  if (!stars) return [finish];
  return [finish, { stars: 2, text: mark_text(event, stars.two) }, { stars: 3, text: mark_text(event, stars.three) }];
}

export function event_place(event: CareerEvent): string {
  const tier = tier_of(event);
  return `${tier.name} ${tier.events.indexOf(event) + 1} of ${tier.events.length}`;
}

const order = (a: CarChoice, b: CarChoice) => Number(b.fitted) - Number(a.fitted) || Number(b.recommended) - Number(a.recommended) || b.rating.pi - a.rating.pi;

// Cars over the cap come last, nearest it first: the row shows what a garage change would open. A car picked in the
// full picker always gets a place.
export function gate_row(shelves: readonly CarShelf[], picked: string | null): CarChoice[] {
  const all = shelves.flatMap((shelf) => shelf.choices);
  const open = all.filter((c) => c.blocked === null).sort(order);
  const shut = all.filter((c) => c.blocked !== null).sort((a, b) => a.rating.pi - b.rating.pi);
  const row = [...open, ...shut].slice(0, ROW_CARS);
  const extra = picked === null || row.some((c) => c.code === picked) ? undefined : all.find((c) => c.code === picked);
  return extra ? [...row.slice(0, ROW_CARS - 1), extra] : row;
}

/** The car driven now when it fits the event, else the one the event recommends, else the first that fits. */
export const first_pick = (row: readonly CarChoice[]): string | null =>
  (row.find((c) => c.fitted && c.blocked === null) ?? row.find((c) => c.recommended && c.blocked === null) ?? row.find((c) => c.blocked === null))?.code ?? null;

export const fits = (shelves: readonly CarShelf[], code: string) => shelves.some((shelf) => shelf.choices.some((c) => c.code === code && c.blocked === null));
