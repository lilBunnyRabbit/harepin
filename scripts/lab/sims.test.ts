import { expect, test } from "bun:test";
import { CARS } from "../../src/car/cars";
import { trial_sim } from "./sims";

test("the hairpin sim reads an exit slide: a looser rear steps out further, holds longer and keeps a tighter circle", () => {
  const read = (spec = CARS.sturm) => trial_sim(spec, "hairpin", "asphalt").values;
  const today = read();
  const loose = read({ ...CARS.sturm, tcs_turn_slip: 0.45, rear_grip: CARS.sturm.rear_grip - 0.08 });
  expect(today.map(([key]) => key)).toEqual(["slip", "lag", "exit", "held", "circle"]);
  const [a, b] = [Object.fromEntries(today), Object.fromEntries(loose)];
  expect(b.exit).toBeGreaterThan(a.exit + 5);
  expect(b.held).toBeGreaterThan(a.held);
  expect(b.circle).toBeLessThan(a.circle);
});
