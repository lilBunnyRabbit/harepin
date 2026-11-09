/// <reference types="bun" />
import { expect, test } from "bun:test";
import { lobby_routes, race_laps } from "./lobby";

test("lobby routes: laps only on a closed route, the plausible lap from its length", () => {
  const routes = lobby_routes([
    { id: "circuit", closed: true, length: 4500 },
    { id: "street-1", closed: false, length: 1800 },
  ]);
  expect([...routes.keys()]).toEqual(["circuit", "street-1"]);
  const circuit = routes.get("circuit");
  const street = routes.get("street-1");
  if (!circuit || !street) throw new Error("routes missing");
  expect(race_laps(circuit, 3)).toBe(3);
  expect(race_laps(street, 3)).toBe(1);
  expect(street.min_lap).toBeCloseTo(20_000, 0);
});
