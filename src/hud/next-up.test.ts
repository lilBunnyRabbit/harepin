import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { TIERS, event_of, type CareerEvent } from "../career/career";
import { event_map } from "../career/career-store";
import { map_code } from "../worldgen/kinds/map-code";
import { arrow_turn, next_up } from "./next-up";

const at = (id: string): CareerEvent => event_of(id)!;
const rookie = TIERS[0].events;

test("a fresh profile's next event stands on the loaded map when one is there", () => {
  const island = event_map(at("r1"));
  const up = next_up({}, island);
  expect(up?.place).toEqual({ here: true });
  expect(map_code(event_map(up!.event))).toBe(map_code(island));
});

test("with every flag here at 3 stars it points at another map", () => {
  const island = event_map(at("r1"));
  const done = Object.fromEntries(rookie.filter((e) => map_code(event_map(e)) === map_code(island)).map((e) => [e.id, 3]));
  const up = next_up(done, island);
  expect(up?.place.here).toBe(false);
  expect(done[up!.event.id]).toBeUndefined();
});

test("the arrow turns right for a target on the car's right", () => {
  expect(arrow_turn(0, 0, 10)).toBeCloseTo(0);
  expect(arrow_turn(0, -10, 0)).toBeCloseTo(90);
  expect(arrow_turn(0, 10, 0)).toBeCloseTo(-90);
  expect(Math.abs(arrow_turn(0, 0, -10))).toBeCloseTo(180);
});
