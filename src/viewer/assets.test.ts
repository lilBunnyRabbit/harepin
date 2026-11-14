import { expect, test } from "bun:test";
import { build_code, DEFAULT_BUILD } from "../car/build";
import { export_block, note_query, read_block } from "./export";
import { parse_notes, type Notes } from "./notes";
import { asset_ref, read_asked, settled_view, view_key, view_query, type ViewState } from "./view-state";
import { building_picks, ground_picks, ramp_picks, stood_building, stood_lot, stood_ramp, world_data } from "./world-items";

const cam = { yaw: 20, pitch: 12, dist: 40, target: [0, 6, 0] as [number, number, number], fov: 30 };
const car: ViewState = settled_view({ car: "sturm", preset: "aero4", code: "sturm.4.0.4.1.0", steer: 0, light: "day", cam });
const stand_in = { car: DEFAULT_BUILD.car, preset: "stock", code: build_code(DEFAULT_BUILD) };
const wheel: ViewState = { ...car, asset: { kind: "wheel", on: false } };
const wing_on: ViewState = { ...car, asset: { kind: "wing", on: true } };
const tower: ViewState = { ...car, ...stand_in, asset: { kind: "building", world: "mainland", item: "b12", seed: 3 } };
const pine: ViewState = { ...car, ...stand_in, light: "dusk", asset: { kind: "tree", world: "alpine", item: "pine", seed: 0 } };

const notes: Notes = {
  [view_key(car)]: [{ text: "car", pin: null, view: car }],
  [view_key(wheel)]: [{ text: "rim dish too deep", pin: [0.8, 0.3, 1.3], view: wheel }],
  [view_key(wing_on)]: [{ text: "wing on the car", pin: null, view: wing_on }],
  [view_key(tower)]: [{ text: "clock face \"floats\"", pin: [0, 14.2, 2.7], view: tower }],
  [view_key(pine)]: [{ text: "crown", pin: null, view: pine }],
};

test("every asset files under its own key, the car under the key it always had", () => {
  expect(Object.keys(notes)).toEqual(["sturm/aero4", "wheel:sturm/aero4@0", "wing:sturm/aero4@0", "building:mainland/b12@3", "tree:alpine/pine@0"]);
  expect(asset_ref(tower)).toEqual({ kind: "building", id: "mainland", variant: "b12", seed: 3 });
});

test("an asset block names kind, id, variant and seed, and reads back to the notes it came from", () => {
  const block = export_block(notes, "0.43.0", { width: 1440, height: 900 }, new Date(0));
  expect(block.split("\n")).toEqual([
    "#cars v0.43.0 1970-01-01T00:00Z 1440x900",
    "#asset building mainland b12 3 1 note",
    " c 1 - cam=20,12,40,0,6,0,30 steer=0 light=day pin=0,14.2,2.7",
    ' n "clock face \\"floats\\""',
    "#car sturm aero4 1 note",
    " c - sturm.4.0.4.1.0 cam=20,12,40,0,6,0,30 steer=0 light=day",
    ' n "car"',
    "#asset tree alpine pine 0 1 note",
    " c - - cam=20,12,40,0,6,0,30 steer=0 light=dusk",
    ' n "crown"',
    "#asset wheel sturm aero4 0 1 note",
    " c 1 sturm.4.0.4.1.0 cam=20,12,40,0,6,0,30 steer=0 light=day pin=0.8,0.3,1.3",
    ' n "rim dish too deep"',
    "#asset wing sturm aero4 0 1 note",
    " c - sturm.4.0.4.1.0 cam=20,12,40,0,6,0,30 steer=0 light=day on=1",
    ' n "wing on the car"',
    "#end 5 presets 5 notes",
  ]);
  const read = read_block(`pasted:\r\n${block.replaceAll("\n", " \r\n")}`);
  expect(read.map(({ n, ...note }) => note)).toEqual([tower, car, pine, wheel, wing_on].map((view) => notes[view_key(view)][0]));
});

test("one car's block keeps its parts; one world's keeps its assets", () => {
  const sturm = export_block(notes, "0", { width: 1, height: 1 }, new Date(0), "sturm");
  expect(sturm).toContain("#asset wheel sturm");
  expect(sturm).not.toContain("mainland");
  expect(export_block(notes, "0", { width: 1, height: 1 }, new Date(0), "mainland")).toContain("#end 1 preset 1 note");
});

test("a broken asset header or a world note carrying a build drops only its notes", () => {
  const block = export_block(notes, "0", { width: 1, height: 1 }, new Date(0));
  expect(read_block(block.replace("#asset building mainland b12", "#asset building nowhere b12")).length).toBe(4);
  expect(read_block(block.replace("#asset tree alpine pine 0", "#asset tree alpine Pine! 0")).length).toBe(4);
  expect(read_block(block.replace(" c - - cam=20,12,40,0,6,0,30 steer=0 light=dusk", " c - sturm.4.0.4.1.0 cam=20,12,40,0,6,0,30 steer=0 light=dusk")).length).toBe(4);
});

test("an asset rides the URL, and a note's shot link holds it", () => {
  const query = view_query(tower);
  expect(query).toContain("&a=building&w=mainland&i=b12&s=3");
  expect(read_asked(new URLSearchParams(query), "hatch").view).toEqual(tower);
  expect(view_query(wing_on)).toContain("&a=wing&on=1");
  expect(read_asked(new URLSearchParams(view_query(wing_on)), "hatch").view).toEqual(wing_on);
  expect(read_asked(new URLSearchParams("?cars&a=building&w=mars&i=b1&s=1"), "hatch").view.asset).toBeUndefined();
  expect(read_asked(new URLSearchParams("?cars&a=tree&w=alpine&i=pine&s=9"), "hatch").view.asset).toEqual({ kind: "tree", world: "alpine", item: "pine", seed: 0 });
  const [note] = read_block(export_block({ [view_key(tower)]: notes[view_key(tower)] }, "0", { width: 1, height: 1 }, new Date(0)));
  expect(note_query(note, true)).toContain("&a=building&w=mainland&i=b12&s=3&pin=0,14.2,2.7,1&shot");
});

test("stored asset notes are checked like the car's", () => {
  expect(parse_notes(JSON.parse(JSON.stringify(notes)))).toEqual(notes);
  const raw = JSON.parse(JSON.stringify(notes));
  raw[view_key(tower)][0].view.asset.seed = -1;
  raw[view_key(wheel)][0].view.asset.on = "yes";
  raw["tree:alpine/pine@0"][0].view.asset.item = "oak tree";
  expect(Object.keys(parse_notes(raw))).toEqual(["sturm/aero4", "wing:sturm/aero4@0"]);
});

test("world assets come out of the generated world, moved onto the stage", () => {
  const data = world_data("mainland", 3);
  const picks = building_picks(data);
  expect(picks.some((pick) => pick.label.startsWith("clock tower"))).toBe(true);
  expect(picks.some((pick) => pick.label.startsWith("terrace"))).toBe(true);
  const b = stood_building(data, picks[0].id);
  const at = data.buildings[Number(picks[0].id.slice(1))];
  expect(b).toEqual({ ...at, x: 0, y: 0, z: 0, fx: 0, fz: 1, angle: 0 });
  expect(stood_building(data, "b99999")).toBeNull();
  expect(stood_building(data, "x1")).toBeNull();
  const market = ground_picks(data).find((pick) => pick.label.startsWith("market square"));
  expect(market && stood_lot(data, market.id)?.ground).toBe("plaza");
  expect(world_data("mainland", 3)).toBe(data);
  const island = world_data("island", 1);
  const ramp = ramp_picks(island)[0];
  expect(stood_ramp(island, ramp.id)).toMatchObject({ x: 0, y: 0, z: 0, fx: 0, fz: 1 });
});
