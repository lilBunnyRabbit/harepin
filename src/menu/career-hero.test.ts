import "../../scripts/fake-dom";
import { describe, expect, test } from "bun:test";
import { render } from "svelte/server";
import { EVENTS, type Stars } from "../career/career";
import CareerHero from "./CareerHero.svelte";

const hero = (stars: Stars) => render(CareerHero, { props: { stars, onstart: () => {}, onall: () => {} } }).body;

describe("career hero", () => {
  test("a fresh career offers the first event, two picks and All events", () => {
    const out = hero({});
    expect(out).toContain("Continue career");
    expect(out).toContain("Next event · r1");
    expect(out).toContain("First lap");
    expect(out.match(/data-size="sm"/g)?.length).toBe(2);
    expect(out).toContain("All events");
  });

  test("a locked next tier puts its gate on the star bar", () => {
    const out = hero({ r1: 3, r2: 2, r3: 1, r4: 2 });
    expect(out).toMatch(/opens at \d+ ★/);
    expect(out).toContain("ui-mark");
  });

  test("an all-done career leaves only All events", () => {
    const out = hero(Object.fromEntries(EVENTS.map((event) => [event.id, 3])));
    expect(out).not.toContain("Continue career");
    expect(out).not.toContain("Next event");
    expect(out).toContain("All events");
  });
});
