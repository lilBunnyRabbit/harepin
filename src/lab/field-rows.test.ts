import { expect, test } from "bun:test";
import type { RacerStats } from "../ai/field";
import { field_lines, field_rows, read_field_rows } from "./field-rows";

const stats = (spins: number): RacerStats => ({ laps: [], finish: Infinity, contacts: 2, hardest: 3.14, spins, overtakes: 1, reverses: 0, resets: 0, offroad: 0 });

const rows = field_rows(
  [
    { car: 1, you: false, name: "Kaze 3", finish: 241.25, gap: 0 },
    { car: 2, you: true, name: "You", finish: 243.5, gap: 2.25 },
    { car: 0, you: false, name: "Sturm 2", finish: Infinity, gap: NaN },
  ],
  [stats(0), stats(1)],
);

test("the player's row carries no AI counts, a car still racing no finish", () => {
  expect(rows[1].ai).toBeNull();
  expect(rows[2].finish).toBeNaN();
  expect(rows[0].ai?.spins).toBe(1);
  expect(field_lines(rows)).toEqual([' f P1 "Kaze 3" 241.3 +0 spins=1 resets=0 hits=2 hard=3.1 pass=1', " f P2 you 243.5 +2.3", ' f P3 "Sturm 2" racing - spins=0 resets=0 hits=2 hard=3.1 pass=1']);
});

test("rows survive JSON, a bad one drops them all", () => {
  expect(read_field_rows(JSON.parse(JSON.stringify(rows)))).toEqual(rows);
  expect(read_field_rows([{ ...rows[0], ai: { ...rows[0].ai, spins: -1 } }])).toBeNull();
  expect(read_field_rows([{ ...rows[0], name: 7 }])).toBeNull();
  expect(read_field_rows("rows")).toBeNull();
});
