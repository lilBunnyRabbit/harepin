import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { car_fit } from "./events-view";

const capped = (cap: "c" | "x") => ({ cap, car_sized_only: false });

test("the start sheet says how the car sits against the cap and when the Garage helps", () => {
  expect(car_fit({ class: "b", pi: 540 }, capped("c"), "Over C")).toEqual({ text: "Over the C cap: detune it in the Garage", off: true, tune: true });
  expect(car_fit({ class: "c", pi: 418 }, capped("c"), null)).toEqual({ text: "Room up to C 499: tune it in the Garage", off: false, tune: true });
  expect(car_fit({ class: "d", pi: 300 }, capped("c"), null).tune).toBe(true);
  expect(car_fit({ class: "c", pi: 490 }, capped("c"), null)).toEqual({ text: "Your car fits", off: false, tune: false });
  expect(car_fit({ class: "x", pi: 960 }, capped("x"), null).text).toBe("Room up to X 999: tune it in the Garage");
  expect(car_fit({ class: "c", pi: 490 }, capped("c"), "Own a Sajin first")).toEqual({ text: "Own a Sajin first: pick another next", off: true, tune: false });
  expect(car_fit({ class: "s1", pi: 720 }, null, null).tune).toBe(false);
});
