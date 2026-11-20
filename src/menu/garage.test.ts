import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, build_code } from "../car/build";
import { stock_build } from "../career/series";
import { Garage } from "./garage.svelte";

const RALLY = build_code(stock_build("rally"));
const OWN = build_code(DEFAULT_BUILD);

test("a meet's leave gives back the meet's lent car", () => {
  const garage = new Garage(DEFAULT_BUILD);
  expect(garage.locks.rally).toBeTruthy();
  garage.meet_pick(RALLY);
  expect(garage.code).toBe(RALLY);
  garage.take_back();
  expect(garage.code).toBe(OWN);
});

test("a meet's leave keeps a cup's loaner on for its run", () => {
  const garage = new Garage(DEFAULT_BUILD);
  const changes: string[] = [];
  garage.on_change = (next) => changes.push(build_code(next));
  garage.lend(RALLY);
  garage.take_back();
  expect(garage.code).toBe(RALLY);
  expect(changes).toEqual([RALLY]);
  garage.use_code(OWN);
  expect(garage.code).toBe(OWN);
});
