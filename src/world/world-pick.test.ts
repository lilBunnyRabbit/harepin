import { expect, test } from "bun:test";
import { seed_of } from "../rng";
import { MAINLAND_SEED, mainland_seed, pick_world, world_query } from "./world-pick";
import { WorldKind } from "../worldgen/types";

const saved = { last_seed: 4242, last_world: WorldKind.SKY, played: true };
const none = { last_seed: null, last_world: null, played: false };
const old = { last_seed: null, last_world: null, played: true };
const url = (query: string) => new URLSearchParams(query);

test("a bare URL resumes the last pick", () => {
  expect(pick_world(url(""), "lobby", saved)).toEqual({ seed: 4242, kind: WorldKind.SKY });
});

test("a new player starts on the room's mainland", () => {
  expect(pick_world(url(""), "lobby", none)).toEqual({ seed: seed_of("lobby"), kind: WorldKind.MAINLAND });
});

test("a player from before the mainland, with nothing picked, stays on the island", () => {
  expect(pick_world(url(""), "lobby", old)).toEqual({ seed: seed_of("lobby"), kind: WorldKind.ISLAND });
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
  expect(pick_world(url(""), "lobby", { last_seed: 9, last_world: null, played: true })).toEqual({ seed: 9, kind: WorldKind.ISLAND });
  expect(pick_world(url(""), "lobby", { last_seed: null, last_world: WorldKind.SKY, played: true })).toEqual({ seed: seed_of("lobby"), kind: WorldKind.SKY });
});

test("a world query names the world only when it is not the island", () => {
  expect(world_query("pals", 77, WorldKind.ISLAND)).toEqual({ room: "pals", seed: "77" });
  expect(world_query("pals", 77, WorldKind.SKY)).toEqual({ room: "pals", seed: "77", world: "sky" });
  const back = new URLSearchParams(world_query("my room", 77, WorldKind.SKY));
  expect(pick_world(back, "my room", none)).toEqual({ seed: 77, kind: WorldKind.SKY });
});

test("Play's mainland: the one driven, else the last picked, else everyone's", () => {
  expect(mainland_seed({ seed: 5, kind: WorldKind.MAINLAND }, 9)).toBe(5);
  expect(mainland_seed({ seed: 5, kind: WorldKind.SKY }, 9)).toBe(9);
  expect(mainland_seed({ seed: 5, kind: WorldKind.SKY }, null)).toBe(MAINLAND_SEED);
});
