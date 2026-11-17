import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { SEASONS } from "../career/series-seasons";
import { WorldKind } from "../worldgen/types";
import { came_from, travel_of, travel_query } from "./travel";

const saved = { last_seed: 3, last_world: WorldKind.ISLAND, last_map: null, played: true };
const url = (query: string) => new URLSearchParams(query);
const here = new URL("https://example.com/harepin/?event=r6");

test("a plain load travels nowhere", () => {
  expect(travel_of(url(""), null, saved)).toBeNull();
  expect(travel_of(url("room=pals&seed=7"), null, saved)).toBeNull();
});

test("an event names its map, and the map the player left", () => {
  const travel = travel_of(url("event=r6"), url(""), saved);
  expect(travel && { from: travel.from, to: travel.to, kind: travel.map.kind, event: "event" in travel ? travel.event.id : null }).toEqual({
    from: "Island · Harwar",
    to: "Sky · Burrver",
    kind: WorldKind.SKY,
    event: "r6",
  });
});

test("an event's map left from another event reads off that event", () => {
  expect(travel_of(url("event=r6"), url("event=r4"), saved)?.from).toBe(travel_of(url("event=r4"), null, saved)?.to);
});

test("a reload on the same map, or a link opened cold, names no map left", () => {
  expect(travel_of(url("event=r6"), url("event=r7"), saved)?.from).toBeNull();
  expect(travel_of(url("event=r6"), null, saved)?.from).toBeNull();
});

test("a run travels to its plain map", () => {
  const travel = travel_of(url("run=daily:2026-11-16"), null, saved);
  expect(travel !== null && "run" in travel && travel.run.kind === travel.map.kind).toBe(true);
});

test("the referrer counts only when it was this page", () => {
  expect(came_from("https://example.com/harepin/?seed=4", here)?.get("seed")).toBe("4");
  expect(came_from("https://example.com/harepin/", here)?.size).toBe(0);
  expect(came_from("https://other.site/harepin/?seed=4", here)).toBeNull();
  expect(came_from("https://example.com/elsewhere/", here)).toBeNull();
  expect(came_from("", here)).toBeNull();
});

test("a Series race travels to its season's world on the event's seed", () => {
  const season = SEASONS[0];
  const event = season.events[0];
  const travel = travel_of(url(`series=${event.id}&seed=${event.seed}&world=${season.world}`), null, saved);
  expect(travel !== null && "series" in travel && [travel.series.event.id, travel.map.kind, travel.map.seed]).toEqual([event.id, season.world, event.seed]);
});

test("a travel keeps the room, tune and car, but a car taken in the picker wins over the URL's", () => {
  const here = url("room=pals&car=coupe&tune&seed=7");
  expect(travel_query({ event: "r6" }, here, false).toString()).toBe("event=r6&room=pals&car=coupe&tune=");
  expect(travel_query({ event: "r6" }, here, true).toString()).toBe("event=r6&room=pals&tune=");
});
