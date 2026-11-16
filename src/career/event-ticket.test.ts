import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { event_of, type CareerEvent } from "./career";
import { event_map } from "./career-store";
import { event_ticket } from "./event-ticket";
import { place_of } from "./place";

const at = (id: string): CareerEvent => event_of(id)!;

test("an event here names its tier place; one on another map says so", () => {
  const here = event_map(at("r1"));
  expect(event_ticket(at("r2"), place_of(event_map(at("r2")), here))).toEqual({ tier: 1, eyebrow: "Next up · Rookie 2 of 7", title: at("r2").name, place: { here: true } });
  const away = event_ticket(at("r6"), place_of(event_map(at("r6")), here));
  expect(away.eyebrow).toBe("Next up · on another map");
  expect(away.place.here).toBe(false);
});
