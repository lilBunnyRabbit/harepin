import { expect, test } from "bun:test";
import { seed_of } from "../rng";
import { map_code, parse_map_code, pick_world, world_query } from "./world-pick";
import { WorldKind } from "../worldgen/types";

const saved = { last_seed: 4242, last_world: WorldKind.SKY, last_opts: null };
const none = { last_seed: null, last_world: null, last_opts: null };
const url = (query: string) => new URLSearchParams(query);

test("a bare URL resumes the last pick", () => {
  expect(pick_world(url(""), "lobby", saved)).toEqual({ seed: 4242, kind: WorldKind.SKY, opts: "" });
});

test("with nothing picked, the room's own map", () => {
  expect(pick_world(url(""), "lobby", none)).toEqual({ seed: seed_of("lobby"), kind: WorldKind.ISLAND, opts: "" });
});

test("an invite link wins over the saved pick", () => {
  expect(pick_world(url("room=pals&seed=77"), "pals", saved)).toEqual({ seed: 77, kind: WorldKind.ISLAND, opts: "" });
  expect(pick_world(url("room=pals&seed=77&world=sky"), "pals", saved)).toEqual({ seed: 77, kind: WorldKind.SKY, opts: "" });
});

test("a room link alone opens that room's map, not the saved one", () => {
  expect(pick_world(url("room=pals"), "pals", saved)).toEqual({ seed: seed_of("pals"), kind: WorldKind.ISLAND, opts: "" });
});

test("a world param alone keeps its kind and drops the saved seed", () => {
  expect(pick_world(url("world=sky"), "lobby", saved)).toEqual({ seed: seed_of("lobby"), kind: WorldKind.SKY, opts: "" });
});

test("a broken seed falls back to the room's map, never the saved one", () => {
  expect(pick_world(url("room=pals&seed=nope"), "pals", saved)).toEqual({ seed: seed_of("pals"), kind: WorldKind.ISLAND, opts: "" });
});

test("half a pick fills the other half from the defaults", () => {
  expect(pick_world(url(""), "lobby", { last_seed: 9, last_world: null, last_opts: null })).toEqual({ seed: 9, kind: WorldKind.ISLAND, opts: "" });
  expect(pick_world(url(""), "lobby", { last_seed: null, last_world: WorldKind.SKY, last_opts: null })).toEqual({ seed: seed_of("lobby"), kind: WorldKind.SKY, opts: "" });
});

test("a world query names the world only when it is not the island", () => {
  expect(world_query("pals", 77, WorldKind.ISLAND)).toEqual({ room: "pals", seed: "77" });
  expect(world_query("pals", 77, WorldKind.SKY)).toEqual({ room: "pals", seed: "77", world: "sky" });
  const back = new URLSearchParams(world_query("my room", 77, WorldKind.SKY));
  expect(pick_world(back, "my room", { last_seed: null, last_world: null, last_opts: null })).toEqual({ seed: 77, kind: WorldKind.SKY, opts: "" });
});

test("options ride in the URL and the saved pick, and only as a code the kind has", () => {
  expect(pick_world(url("room=pals&seed=77&opts=121111"), "pals", saved)).toEqual({ seed: 77, kind: WorldKind.ISLAND, opts: "121111" });
  expect(pick_world(url("room=pals&seed=77&opts=111111"), "pals", saved).opts).toBe("");
  expect(pick_world(url("room=pals&seed=77&opts=9"), "pals", saved).opts).toBe("");
  expect(pick_world(url(""), "lobby", { ...saved, last_opts: "10111" })).toEqual({ seed: 4242, kind: WorldKind.SKY, opts: "10111" });
  expect(pick_world(url(""), "lobby", { ...saved, last_opts: "121111" }).opts).toBe("");
  expect(world_query("pals", 77, WorldKind.SKY, "10111")).toEqual({ room: "pals", seed: "77", world: "sky", opts: "10111" });
  expect(pick_world(new URLSearchParams(world_query("pals", 77, WorldKind.SKY, "10111")), "pals", saved)).toEqual({ seed: 77, kind: WorldKind.SKY, opts: "10111" });
});

test("a map code is the seed, then the options", () => {
  expect(map_code(42, "")).toBe("42");
  expect(map_code(42, "121111")).toBe("42-121111");
  expect(parse_map_code(" 42-121111 ", WorldKind.ISLAND)).toEqual({ seed: 42, opts: "121111" });
  expect(parse_map_code("42", WorldKind.ISLAND)).toEqual({ seed: 42, opts: "" });
  expect(parse_map_code("42-111111", WorldKind.ISLAND)).toEqual({ seed: 42, opts: "" });
  for (const bad of ["42-12", "42-121111-1", "x-121111", "42-921111"]) expect(parse_map_code(bad, WorldKind.ISLAND)).toBeNull();
  expect(parse_map_code("42-121111", WorldKind.SKY)).toBeNull();
});
