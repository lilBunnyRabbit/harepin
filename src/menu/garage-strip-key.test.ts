/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEFAULT_BUILD } from "../car/build";
import { strip_key } from "./garage-strip-key";

const upgraded = { ...DEFAULT_BUILD, parts: { ...DEFAULT_BUILD.parts, engine: 2 } };

test("car cards rebuild when the fitted parts change, so their class badges never go stale", () => {
  const car = { id: "car", kind: "car", count: 9 } as const;
  expect(strip_key(car, 0, upgraded)).not.toBe(strip_key(car, 0, DEFAULT_BUILD));
});

test("part cards keep their strip across a fit, so its scroll stays put", () => {
  const engine = { id: "engine", kind: "part", count: 3 } as const;
  expect(strip_key(engine, 1, upgraded)).toBe(strip_key(engine, 1, DEFAULT_BUILD));
});
