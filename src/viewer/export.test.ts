import { expect, test } from "bun:test";
import { build_code, parse_build } from "../car/build";
import { CARS, is_car } from "../car/cars";
import { export_block, note_query, read_block } from "./export";
import { parse_notes, type Notes } from "./notes";
import { viewer_build, viewer_presets } from "./presets";
import { read_asked, settled_view, view_query, type ViewState } from "./view-state";

const view: ViewState = settled_view({
  car: "sturm",
  preset: "aero4",
  code: "sturm.4.0.4.1.0",
  steer: 0.5,
  light: "dusk",
  cam: { yaw: 35.04, pitch: 14, dist: 7.21234, target: [0, 0.6, 0], fov: 30 },
});

const notes: Notes = {
  "sturm/aero4": [
    { text: "lip too thick here,\n and \"wavy\"", pin: [0.412, 0.88, -1.9], view },
    { text: "wing reads fine", pin: null, view: { ...view, light: "day", steer: 0 } },
  ],
  "hatch/stock": [{ text: "ok", pin: [0.1, 0.2, 0.3], view: { ...view, car: "hatch", preset: "stock", code: "hatch.4.0.0.1.0" } }],
};

test("the export block reads like docs/cars.md says", () => {
  const block = export_block(notes, "0.42.2", { width: 1440, height: 900 }, new Date("2026-11-14T10:02:30Z"));
  expect(block.split("\n")).toEqual([
    "#cars v0.42.2 2026-11-14T10:02Z 1440x900",
    "#car hatch stock 1 note",
    " c 1 hatch.4.0.0.1.0 cam=35,14,7.212,0,0.6,0,30 steer=0.5 light=dusk pin=0.1,0.2,0.3",
    ' n "ok"',
    "#car sturm aero4 2 notes",
    " c 1 sturm.4.0.4.1.0 cam=35,14,7.212,0,0.6,0,30 steer=0.5 light=dusk pin=0.412,0.88,-1.9",
    ' n "lip too thick here,\\n and \\"wavy\\""',
    " c - sturm.4.0.4.1.0 cam=35,14,7.212,0,0.6,0,30 steer=0 light=day",
    ' n "wing reads fine"',
    "#end 2 presets 3 notes",
  ]);
});

test("one car's block holds only that car", () => {
  const block = export_block(notes, "0.42.2", { width: 844, height: 390 }, new Date(0), "sturm");
  expect(block).not.toContain("hatch");
  expect(block.endsWith("#end 1 preset 2 notes")).toBe(true);
});

test("a block reads back to the notes it came from, through a chat app's CRLF and padding", () => {
  const block = export_block(notes, "0.42.2", { width: 1440, height: 900 }, new Date(0));
  const pasted = `hey, notes:\r\n${block.split("\n").join("  \r\n")}\r\n`;
  const read = read_block(pasted);
  const flat = [...notes["hatch/stock"], ...notes["sturm/aero4"]];
  expect(read.map(({ n, ...note }) => note)).toEqual(flat);
  expect(read.map((r) => r.n)).toEqual([1, 1, null]);
});

test("a broken line drops its note, not the block", () => {
  const block = export_block(notes, "0.42.2", { width: 1, height: 1 }, new Date(0)).replace("cam=35,14,7.212,0,0.6,0,30 steer=0.5 light=dusk pin=0.1", "cam=x steer=0.5 light=dusk pin=0.1");
  expect(read_block(block).length).toBe(2);
});

test("a view round-trips through its URL", () => {
  const pin = { at: [0.412, 0.88, -1.9] as [number, number, number], n: 3 };
  const query = view_query(view, pin);
  expect(query).toBe("?cars=sturm&p=aero4&b=sturm.4.0.4.1.0&cam=35,14,7.212,0,0.6,0,30&steer=0.5&light=dusk&pin=0.412,0.88,-1.9,3");
  const asked = read_asked(new URLSearchParams(`${query}&shot`), "hatch");
  expect(asked.view).toEqual(view);
  expect(asked.pin).toEqual(pin);
  expect(asked.shot).toBe(true);
  const [first] = read_block(export_block(notes, "0", { width: 1, height: 1 }, new Date(0), "sturm"));
  expect(note_query(first, true)).toBe(`${query.replace(/,3$/, ",1")}&shot`);
});

test("a bad URL falls back piece by piece", () => {
  const asked = read_asked(new URLSearchParams("?cars=nope&b=junk&cam=1,2&steer=9&light=noon&pin=1,2"), "hatch");
  expect(asked.view).toEqual({ car: "hatch", steer: 1 });
  expect(asked.pin).toBeNull();
});

test("stored notes are checked on load", () => {
  const raw = JSON.parse(JSON.stringify(notes));
  raw["sturm/aero4"].push({ text: "x", pin: [1, 2], view });
  raw["sturm/aero4"].push({ text: "x", pin: null, view: { ...view, code: "kaze.4.0.0.1.0" } });
  raw["hatch/stock"][0].view.cam.yaw = "35";
  raw["coupe/stock"] = [{ text: "wrong key", pin: null, view }];
  raw["bus/stock"] = "nope";
  expect(parse_notes(raw)).toEqual({ "sturm/aero4": notes["sturm/aero4"] });
  expect(parse_notes(null)).toEqual({});
  expect(parse_notes([1])).toEqual({});
});

test("every car has its presets, and every preset builds a code that parses", () => {
  for (const car of Object.keys(CARS).filter(is_car)) {
    const presets = viewer_presets(car);
    expect(presets.map((p) => p.id).slice(0, 7)).toEqual(["stock", "aero1", "aero2", "aero3", "aero4", "mid", "max"]);
    expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
    for (const preset of presets) expect(parse_build(build_code(viewer_build(car, preset, 4)))?.car).toBe(car);
  }
  expect(viewer_presets("muscle").some((p) => p.id === "preset-drift")).toBe(true);
});
