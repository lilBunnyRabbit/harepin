import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { RALLY_TRIAL, SEASONS } from "../career/series-seasons";
import { WorldKind } from "../worldgen/types";
import { brief_of } from "./brief";
import { travel_of } from "./travel";

const saved = { last_seed: 3, last_world: WorldKind.ISLAND, last_map: null, played: true };
const brief = (query: string) => brief_of(travel_of(new URLSearchParams(query), null, saved)!);

test("an event's briefing names its place in the tier, its star marks and the class it lets in", () => {
  const facts = brief("event=r1");
  expect(facts).toMatchObject({ eyebrow: "Rookie 1 of 7 · Race", name: "First lap", lent: null, specs: [{ label: "Car", value: "Class C or below" }] });
  expect(facts.marks.map((mark) => mark.stars)).toEqual([1, 2, 3]);
  expect(facts.goal).not.toBe("");
});

test("an event with its own car shows the lent one", () => {
  expect(brief("event=r4").lent).toEqual({ car: "rally", name: "Dirt rally" });
});

test("a Series race says which round it is", () => {
  const season = SEASONS[0];
  const event = season.events[0];
  expect(brief(`series=${event.id}&seed=${event.seed}&world=${season.world}`)).toMatchObject({ eyebrow: `${season.name} series · Round 1 of ${season.events.length}`, name: event.name, marks: [] });
  const cup = RALLY_TRIAL.events[0];
  expect(brief(`series=${cup.id}&seed=${cup.seed}&world=${RALLY_TRIAL.world}`)).toMatchObject({ eyebrow: "Rally Trial · Round 1 of 3", lent: { car: "rally", name: "Stock Rally" }, specs: [{ label: "Car", value: "Loaner: stock Rally" }] });
});
