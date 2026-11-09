import { expect, test } from "bun:test";
import { seed_of } from "./rng";
import { pick_world } from "./world-pick";
import { WorldKind } from "./worldgen/types";

const saved = { last_seed: 4242, last_world: WorldKind.SKY };
const none = { last_seed: null, last_world: null };
const url = (query: string) => new URLSearchParams(query);

test("a bare URL resumes the last pick", () => {
  expect(pick_world(url(""), "lobby", saved)).toEqual({ seed: 4242, kind: WorldKind.SKY });
});

test("with nothing picked, the room's own map", () => {
  expect(pick_world(url(""), "lobby", none)).toEqual({ seed: seed_of("lobby"), kind: WorldKind.ISLAND });
});

test("an invite link wins over the saved pick", () => {
  expect(pick_world(url("room=pals&seed=77"), "pals", saved)).toEqual({ seed: 77, kind: WorldKind.ISLAND });
  expect(pick_world(url("room=pals&seed=77&world=sky"), "pals", saved)).toEqual({ seed: 77, kind: WorldKind.SKY });
});

test("a room link alone opens that room's map, not the saved one", () => {
  expect(pick_world(url("room=pals"), "pals", saved)).toEqual({ seed: seed_of("pals"), kind: WorldKind.ISLAND });
});

test("a world param alone keeps its kind and drops the saved seed", () => {
  expect(pick_world(url("world=sky"), "lobby", saved)).toEqual({ seed: seed_of("lobby"), kind: WorldKind.SKY });
});

test("a broken seed falls back to the room's map, never the saved one", () => {
  expect(pick_world(url("room=pals&seed=nope"), "pals", saved)).toEqual({ seed: seed_of("pals"), kind: WorldKind.ISLAND });
});

test("half a pick fills the other half from the defaults", () => {
  expect(pick_world(url(""), "lobby", { last_seed: 9, last_world: null })).toEqual({ seed: 9, kind: WorldKind.ISLAND });
  expect(pick_world(url(""), "lobby", { last_seed: null, last_world: WorldKind.SKY })).toEqual({ seed: seed_of("lobby"), kind: WorldKind.SKY });
});
