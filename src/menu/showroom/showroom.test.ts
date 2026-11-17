import { expect, test } from "bun:test";
import { DEFAULT_BUILD, WHOLE_CAR } from "../../car/build";
import { Showroom, type RoomStage, type ShowroomWindow } from "./showroom";

type Listener = () => void;

function fake_stage() {
  const calls: string[] = [];
  const stage: RoomStage = {
    canvas: { hidden: false },
    start: () => calls.push("start"),
    stop: () => calls.push("stop"),
    show: () => calls.push("show"),
    aim: () => calls.push("aim"),
    resize: () => calls.push("resize"),
  };
  return { stage, calls };
}

function fake_window(narrow: boolean) {
  const heard = new Map<string, Set<Listener>>();
  const listen = (type: string, on: Listener) => void heard.set(type, (heard.get(type) ?? new Set()).add(on));
  const unlisten = (type: string, on: Listener) => void heard.get(type)?.delete(on);
  const media = { matches: narrow, addEventListener: listen, removeEventListener: unlisten };
  const win = { addEventListener: listen, removeEventListener: unlisten, matchMedia: () => media } as unknown as ShowroomWindow;
  const fire = (type: string) => {
    for (const on of [...(heard.get(type) ?? [])]) on();
  };
  const listeners = () => [...heard.values()].reduce((sum, set) => sum + set.size, 0);
  return { win, media, fire, listeners };
}

function room(narrow = false) {
  const { stage, calls } = fake_stage();
  const fake = fake_window(narrow);
  const showroom = new Showroom(stage, { build: () => DEFAULT_BUILD, panels: () => [] }, fake.win);
  const stops = () => calls.filter((call) => call === "stop").length;
  return { showroom, stage, calls, stops, ...fake };
}

test("the stage starts hidden and holds no GL context until a car room shows", () => {
  const { showroom, stage, calls } = room();
  expect(stage.canvas.hidden).toBe(true);
  expect(calls).toEqual([]);
  expect(showroom.hides_world_car).toBe(false);
});

test("a car room starts the stage, draws the build and frames it", () => {
  const { showroom, stage, calls } = room();
  showroom.show("beside");
  expect(calls).toEqual(["start", "show", "resize"]);
  expect(stage.canvas.hidden).toBe(false);
  expect(showroom.hides_world_car).toBe(true);
});

test("closing stops the stage once, which gives its GL context back, and drops every listener", () => {
  const { showroom, stage, stops, listeners } = room();
  showroom.show("around");
  showroom.hide();
  expect(stops()).toBe(1);
  expect(stage.canvas.hidden).toBe(true);
  expect(showroom.hides_world_car).toBe(false);
  expect(listeners()).toBe(0);
  showroom.hide();
  expect(stops()).toBe(1);
});

test("a bare room stops the stage and still hides the world's car", () => {
  const { showroom, calls, stops } = room();
  showroom.show("beside");
  showroom.show("bare");
  expect(stops()).toBe(1);
  expect(showroom.hides_world_car).toBe(true);
  showroom.show("around");
  expect(calls.slice(-3)).toEqual(["start", "show", "resize"]);
});

test("a screen too narrow for a car beside the page drops the stage; a room around the car keeps it", () => {
  const { showroom, calls, stops, media, fire } = room(true);
  showroom.show("beside");
  expect(calls).toEqual([]);
  expect(showroom.hides_world_car).toBe(false);
  media.matches = false;
  fire("change");
  expect(calls).toEqual(["start", "show", "resize"]);
  media.matches = true;
  fire("change");
  expect(stops()).toBe(1);
  showroom.show("around");
  expect(calls.slice(-3)).toEqual(["start", "show", "resize"]);
});

test("a resize frames the car again only while the stage is up", () => {
  const { showroom, calls, fire } = room();
  showroom.show("beside");
  fire("resize");
  expect(calls.at(-1)).toBe("resize");
  showroom.hide();
  const before = calls.length;
  fire("resize");
  showroom.reframe();
  showroom.sync();
  expect(calls.length).toBe(before);
});

test("an aim while hidden is the pose the stage starts in, not a turn", () => {
  const { showroom, calls } = room();
  showroom.aim({ yaw: 0.4 });
  expect(calls).toEqual([]);
  showroom.show("around");
  showroom.aim(WHOLE_CAR);
  expect(calls.at(-1)).toBe("aim");
});
