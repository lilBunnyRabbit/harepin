import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { WorldKind } from "../worldgen/types";
import { DEFAULT_BINDINGS } from "./bindings";
import { pause_keys } from "./pause-keys";
import type { PauseAids, RoamCard, RunCard } from "./pause-view.svelte";
import PauseEvent from "./PauseEvent.svelte";
import PauseRoam from "./PauseRoam.svelte";

const AIDS: PauseAids = { tcs: true, abs: true, assist: false, stability: false, auto: true, lights: false };
const none = () => {};

test("free roam: Resume, the four doors and every aid", () => {
  const card: RoamCard = { kind: "roam", map: "Island · Harwar", world: WorldKind.ISLAND, next: "First lap · on this map", next_world: WorldKind.ISLAND, flags: 4, tier: "Rookie 0/21 ★", players: 1, car: "hatch" };
  const html = render(PauseRoam, { props: { card, aids: AIDS, solo: true, caps: pause_keys(DEFAULT_BINDINGS).caps, onact: none, onflip: none, onresume: none } }).body;
  for (const text of ["Paused · free roam", "Island · Harwar", "Resume", "Map", "Events", "Garage", "Online", "4 flags here", "Rookie 0/21 ★", "TC", "Lights"]) expect(html).toContain(text);
  expect(html).toContain('aria-label="Reset car"');
  expect(html).toContain('aria-label="Camera"');
  expect(html).toContain('aria-label="Chat"');
  expect(html).toContain('title="Camera (C)"');
  expect(html).toContain(">Home</kbd>");
});

test("in an event: the run card, its four rows and Resume", () => {
  const card: RunCard = { kind: "event", mode: "Race", title: "First lap", facts: ["gate 1/12", "0:06.2"] };
  const html = render(PauseEvent, { props: { card, aids: AIDS, solo: false, caps: pause_keys(DEFAULT_BINDINGS).caps, onact: none, onflip: none, onresume: none } }).body;
  for (const text of ["Menu · Race", "First lap", "gate 1/12", "Restart", "Car and parts", "Leave event", "Showroom", "Settings", "Resume"]) expect(html).toContain(text);
  expect(html).toContain(">V</kbd>");
  expect(html).not.toContain(">G</kbd>");
});
