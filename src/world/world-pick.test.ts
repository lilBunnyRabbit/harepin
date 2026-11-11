import { expect, test } from "bun:test";
import { seed_of } from "../rng";
import { MAINLAND_SEED, mainland_seed, pick_world, world_query } from "./world-pick";
import { WorldKind } from "../worldgen/types";

const saved = { last_seed: 4242, last_world: WorldKind.SKY, last_map: null, played: true };
const none = { last_seed: null, last_world: null, last_map: null, played: false };
const old = { last_seed: null, last_world: null, last_map: null, played: true };
const url = (query: string) => new URLSearchParams(query);

test("a bare URL resumes the last pick", () => {
  expect(pick_world(url(""), "lobby", saved)).toEqual({ seed: 4242, kind: WorldKind.SKY, code: null });
});

test("a new player starts on the room's mainland", () => {
  expect(pick_world(url(""), "lobby", none)).toEqual({ seed: seed_of("lobby"), kind: WorldKind.MAINLAND, code: null });
});

test("a player from before the mainland, with nothing picked, stays on the island", () => {
  expect(pick_world(url(""), "lobby", old)).toEqual({ seed: seed_of("lobby"), kind: WorldKind.ISLAND, code: null });
});

test("an invite link wins over the saved pick", () => {
  expect(pick_world(url("room=pals&seed=77"), "pals", saved)).toEqual({ seed: 77, kind: WorldKind.ISLAND, code: null });
  expect(pick_world(url("room=pals&seed=77&world=sky"), "pals", saved)).toEqual({ seed: 77, kind: WorldKind.SKY, code: null });
});

test("a room link alone opens that room's map, not the saved one", () => {
  expect(pick_world(url("room=pals"), "pals", saved)).toEqual({ seed: seed_of("pals"), kind: WorldKind.ISLAND, code: null });
});

test("a world param alone keeps its kind and drops the saved seed", () => {
  expect(pick_world(url("world=sky"), "lobby", saved)).toEqual({ seed: seed_of("lobby"), kind: WorldKind.SKY, code: null });
});

test("a broken seed falls back to the room's map, never the saved one", () => {
  expect(pick_world(url("room=pals&seed=nope"), "pals", saved)).toEqual({ seed: seed_of("pals"), kind: WorldKind.ISLAND, code: null });
});

test("half a pick fills the other half from the defaults", () => {
  expect(pick_world(url(""), "lobby", { last_seed: 9, last_world: null, last_map: null, played: true })).toEqual({ seed: 9, kind: WorldKind.ISLAND, code: null });
  expect(pick_world(url(""), "lobby", { last_seed: null, last_world: WorldKind.SKY, last_map: null, played: true })).toEqual({ seed: seed_of("lobby"), kind: WorldKind.SKY, code: null });
});

test("a world query names the world only when it is not the island", () => {
  expect(world_query("pals", 77, WorldKind.ISLAND)).toEqual({ room: "pals", seed: "77" });
  expect(world_query("pals", 77, WorldKind.SKY)).toEqual({ room: "pals", seed: "77", world: "sky" });
  const back = new URLSearchParams(world_query("my room", 77, WorldKind.SKY));
  expect(pick_world(back, "my room", none)).toEqual({ seed: 77, kind: WorldKind.SKY, code: null });
});

test("Play's mainland: the one driven, else the last picked, else everyone's", () => {
  expect(mainland_seed({ seed: 5, kind: WorldKind.MAINLAND }, 9)).toBe(5);
  expect(mainland_seed({ seed: 5, kind: WorldKind.SKY }, 9)).toBe(9);
  expect(mainland_seed({ seed: 5, kind: WorldKind.SKY }, null)).toBe(MAINLAND_SEED);
});

test("a map link wins as a code; the seed and world beside it are only its fallback", () => {
  expect(pick_world(url("room=pals&map=1C000001A-E2"), "pals", saved)).toEqual({ seed: seed_of("pals"), kind: WorldKind.ISLAND, code: "1C000001A-E2" });
  expect(pick_world(url("seed=42&opts=121111"), "lobby", saved)).toEqual({ seed: 42, kind: WorldKind.ISLAND, code: "42-121111" });
  expect(pick_world(url("seed=42&opts=12x"), "lobby", saved)).toEqual({ seed: 42, kind: WorldKind.ISLAND, code: null });
});

test("a bare URL resumes the last custom map; an invite never does", () => {
  const custom = { ...saved, last_map: "1S000001A-A0" };
  expect(pick_world(url(""), "lobby", custom)).toEqual({ seed: 4242, kind: WorldKind.SKY, code: "1S000001A-A0" });
  expect(pick_world(url("room=pals"), "pals", custom).code).toBeNull();
});

test("a custom map's query is its code alone; a plain map's is unchanged", () => {
  expect(world_query("pals", 42, WorldKind.ISLAND, "1C000001A-E2")).toEqual({ room: "pals", map: "1C000001A-E2" });
  expect(world_query("pals", 42, WorldKind.SKY, null)).toEqual({ room: "pals", seed: "42", world: "sky" });
  const back = new URLSearchParams(world_query("pals", 42, WorldKind.ISLAND, "1C000001A-E2"));
  expect(pick_world(back, "pals", none).code).toBe("1C000001A-E2");
});

test("an event link drives the event's map, its stand-in while it has one", () => {
  expect(pick_world(url("event=r4"), "lobby", saved).code).toBe("1D0000005");
  expect(pick_world(url("event=r7"), "lobby", saved).code).toBe("1S0000002");
  expect(pick_world(url("event=zz9"), "lobby", saved).code).toBeNull();
});
