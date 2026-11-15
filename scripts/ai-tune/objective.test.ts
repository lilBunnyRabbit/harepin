import { expect, test } from "bun:test";
import { score } from "./objective";
import type { RaceResult } from "./worker";

const race = (overtakes: number): RaceResult => ({ route: "r", lap: 90, stuck: false, contacts: 4, overtakes, spins: 0, resets: 0, reverses: 0, hardest: 3, rho: 0.3 });
const auto = { "0/r": 100 };

test("an overtake under the floor costs more than one over it earns", () => {
  const at = (n: number, floor: number) => score([{ seed: 0, race: race(n) }], auto, 2, floor).loss;
  expect(at(3, 2) - at(4, 2)).toBeLessThan(at(1, 2) - at(2, 2));
  expect(at(2, 0)).toBe(at(2, 2));
});

test("1% of lap is worth less than one more overtake a race", () => {
  const faster = score([{ seed: 0, race: { ...race(2), lap: 89 } }], auto, 2).loss;
  const passing = score([{ seed: 0, race: race(3) }], auto, 2).loss;
  expect(passing).toBeLessThan(faster);
});
