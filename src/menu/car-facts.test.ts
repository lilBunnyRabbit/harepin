import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { DEFAULT_BUILD, SLOTS } from "../car/build";
import { car_facts, drive_icon, tyre_icon } from "./car-facts";

const SPRITE = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const has_symbol = (id: string) => SPRITE.includes(`<symbol id="${id}"`);

describe("car facts", () => {
  test("every drive and tyre kind has its sprite", () => {
    for (const drive of ["fwd", "rwd", "awd"] as const) expect(has_symbol(drive_icon(drive))).toBe(true);
    for (const part of SLOTS.tyres.parts) expect(has_symbol(tyre_icon(part.name))).toBe(true);
  });

  test("names the fitted tyres and drive in words", () => {
    const facts = car_facts({ ...DEFAULT_BUILD, parts: { ...DEFAULT_BUILD.parts, tyres: 5 } });
    expect(facts.tyres).toEqual({ icon: "icon-tyre-mud-terrain", label: "Mud-terrain tyres", word: "Mud-terrain" });
    expect(facts.drive.word).toBe("FWD");
    expect(facts.meters.map((meter) => meter.key)).toEqual(["power", "grip", "top_speed"]);
  });
});
