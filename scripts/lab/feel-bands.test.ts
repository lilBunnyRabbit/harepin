import { expect, test } from "bun:test";
import { check_bands, read_bands } from "./feel-bands";
import { read_handling } from "./handling-golden";

test("docs/car-feel.md parses, and the committed stock rows sit inside every band not marked draft", () => {
  const bands = read_bands();
  expect(bands.size).toBe(11);
  expect(bands.get("coupe")?.get("t100")).toEqual({ low: 4.8, high: 5.4, draft: false });
  expect(bands.get("sturm")?.get("pwr")?.draft).toBe(true);
  const rows = [...read_handling()].map(([key, line]) => ({ key, car: key.split(".", 1)[0], fields: [], line }));
  const checked = check_bands(rows, bands);
  expect(checked.red).toEqual([]);
  expect(checked.warn.length).toBe(3);
});
