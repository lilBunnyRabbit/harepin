import { expect, test } from "bun:test";
import { CarPicker } from "./car-pick.svelte";

const ask = { title: "Test", limit: "Any car", shelves: [], note: "", back: "Garage" };

test("a pick ends the ask with its code, once", async () => {
  const picker = new CarPicker();
  const shown = picker.open(ask);
  expect(picker.open_ask).toBe(true);
  picker.end("abc");
  picker.end("late");
  expect(await shown).toBe("abc");
  expect(picker.open_ask).toBe(false);
});

test("a second ask ends the first unpicked", async () => {
  const picker = new CarPicker();
  const first = picker.open(ask);
  const second = picker.open(ask);
  picker.end("xyz");
  expect(await first).toBeNull();
  expect(await second).toBe("xyz");
});
