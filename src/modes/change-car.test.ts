import "../../scripts/fake-dom";
import { afterAll, beforeEach, expect, test } from "bun:test";
import { parse_build, build_code } from "../car/build";
import { within } from "../car/car-pick";
import { CARS, car_sized } from "../car/cars";
import { rating } from "../car/pi";
import { PRESETS } from "../car/presets";
import { EVENTS, spot_of } from "../career/career";
import { Career } from "../career/career-store";
import { WorldKind } from "../worldgen/types";
import { GYMKHANA_MODE } from "./gymkhana-mode";
import type { CarLimit } from "../car/car-pick";
import { Modes } from "./modes";
import type { ModeCtx } from "./mode";
import type { RunPlay } from "../runs/run-play";
import { held_car } from "./event-car";

class FakeElement {
  hidden = false;
  disabled = false;
  textContent = "";
  className = "";
  readonly dataset: Record<string, string> = {};
  readonly style = { setProperty() {} };
  private readonly clicks: (() => void)[] = [];
  addEventListener(type: string, listener: () => void) {
    if (type === "click") this.clicks.push(listener);
  }
  click() {
    for (const listener of this.clicks) listener();
  }
  replaceChildren() {}
  append() {}
  setAttribute() {}
}
class FakeButton extends FakeElement {}

// The result card's elements, made as Modes asks for them; ids under mode- that are not the card's text are its buttons.
const elements = new Map<string, FakeElement>();
const doc = document as unknown as Record<string, unknown>;
const fakes = { HTMLElement: FakeElement, HTMLButtonElement: FakeButton, history: { state: null, replaceState() {} } };
const added = Object.keys(fakes).filter((key) => !(key in globalThis));
Object.assign(globalThis, fakes);
doc.getElementById = (id: string) => {
  if (!elements.has(id)) elements.set(id, id.startsWith("mode-") && !id.startsWith("mode-result") ? new FakeButton() : new FakeElement());
  return elements.get(id);
};
const gymkhana_start = GYMKHANA_MODE.start;
const create = doc.createElement;
doc.createElement = () => new FakeElement();
afterAll(() => {
  GYMKHANA_MODE.start = gymkhana_start;
  doc.createElement = create;
  delete doc.getElementById;
  for (const key of added) Reflect.deleteProperty(globalThis, key);
});

const capped = EVENTS.find((e) => e.mode === "gymkhana" && "cap" in e.car)!;
const preset = { ...capped, car: { preset: PRESETS[0].name } };
const cap = "cap" in capped.car ? capped.car.cap : "c";
const cruiser = PRESETS.map((p) => parse_build(p.code)).find((b) => b && within(rating(b).class, cap) && car_sized(CARS[b.car]))!;
const [OWN, FIRST, SECOND] = [1, 2, 3].map((number) => build_code({ ...cruiser, number }));

interface Rig {
  modes: Modes;
  starts: string[];
  disposed: number;
  car: string;
  saved: string[];
  answer: (code: string | null) => void;
  asked: number;
  limit: CarLimit | null;
}

function rig(routes: readonly unknown[] = []): Rig {
  const world = { kind: WorldKind.ISLAND, seed: 1, key: "k", levels: [], routes, ramps: [], tiles: { streamed: false, complete: true } };
  const r = { starts: [], disposed: 0, car: OWN, saved: [], answer: () => {}, asked: 0 } as unknown as Rig;
  r.modes = new Modes(
    {} as never,
    world as never,
    0,
    () => ({ best: {}, wins: 0, podiums: 0 }),
    () => {},
    () => false,
    () => {},
    {} as never,
    () => CARS[parse_build(r.car)!.car],
    new Career(null),
  );
  const { modes } = r;
  modes.car_code = () => r.car;
  modes.fit_car = (code, save) => {
    r.car = code;
    if (save) r.saved.push(code);
  };
  modes.pick_car = (_, limit) => {
    r.asked++;
    r.limit = limit;
    return new Promise((done) => (r.answer = done));
  };
  GYMKHANA_MODE.start = () => {
    r.starts.push(r.car);
    return { update: () => null, finished: () => null, dispose: () => void r.disposed++ };
  };
  modes.start();
  return r;
}

const settle = () => new Promise((done) => setTimeout(done, 0));

async function in_event(r: Rig, pick: string) {
  r.modes.play_event(capped);
  await settle();
  r.answer(pick);
  await settle();
}

beforeEach(() => elements.clear());

test("picking another car mid-event restarts the run on it", async () => {
  const r = rig();
  await in_event(r, FIRST);
  expect(r.starts).toEqual([FIRST]);
  expect(r.modes.can_change_car).toBe(true);

  const change = r.modes.change_car();
  expect(r.modes.holding).toBe(true);
  r.answer(SECOND);
  await change;
  expect(r.starts).toEqual([FIRST, SECOND]);
  expect(r.disposed).toBe(1);
  expect(r.modes.active).toBe(true);
  expect(r.modes.holding).toBe(false);

  r.modes.exit();
  expect(r.car).toBe(OWN);
  expect(r.saved).toEqual([OWN]);
});

test("cancelling the change keeps the car and the run", async () => {
  const r = rig();
  await in_event(r, FIRST);
  const change = r.modes.change_car();
  r.answer(null);
  await change;
  expect(r.starts).toEqual([FIRST]);
  expect(r.disposed).toBe(0);
  expect(r.car).toBe(FIRST);
  expect(r.modes.active).toBe(true);
});

test("picking the player's own car back restarts on it and leaves it on after the event", async () => {
  const r = rig();
  await in_event(r, FIRST);
  const change = r.modes.change_car();
  r.answer(OWN);
  await change;
  expect(r.starts).toEqual([FIRST, OWN]);
  r.modes.exit();
  expect(r.car).toBe(OWN);
});

test("picking the player's own car back ends the loan: a repaint on it stays after the event", async () => {
  const r = rig();
  r.modes.save_car = (code) => r.saved.push(code);
  await in_event(r, FIRST);
  expect(r.modes.borrowed).toBe(true);
  const change = r.modes.change_car();
  r.answer(OWN);
  await change;
  expect(r.modes.borrowed).toBe(false);
  const repainted = build_code({ ...parse_build(OWN)!, paint: parse_build(OWN)!.paint + 1 });
  r.car = repainted;
  const before = r.saved.length;
  r.modes.car_changed();
  r.modes.exit();
  expect(r.car).toBe(repainted);
  expect(r.saved.slice(before)).not.toContain(OWN);
});

test("the result card's Change car button opens the pick", async () => {
  const r = rig();
  await in_event(r, FIRST);
  elements.get("mode-car")!.click();
  expect(r.asked).toBe(2);
  r.answer(SECOND);
  await settle();
  expect(r.starts).toEqual([FIRST, SECOND]);
});

test("a preset event and free play offer no car change", async () => {
  const r = rig();
  expect(r.modes.can_change_car).toBe(false);
  r.modes.play_event(preset);
  await settle();
  expect(r.modes.can_change_car).toBe(false);
  await r.modes.change_car();
  expect(r.asked).toBe(0);
});

test("a run naming a reward car's preset is practice on the starter car for a player without the car", async () => {
  const r = rig();
  const fujin = { ...capped, car: { preset: "Fujin prototype" } };
  const start = GYMKHANA_MODE.start;
  const ctxs: ModeCtx[] = [];
  GYMKHANA_MODE.start = (ctx, level) => (ctxs.push(ctx), start(ctx, level));
  const set_item = localStorage.setItem;
  let writes = 0;
  localStorage.setItem = () => void writes++;
  try {
    r.modes.play_event(fujin, { laps: 3 } as RunPlay);
    await settle();
    expect(r.starts).toEqual([build_code(parse_build(PRESETS[0].code)!)]);
    const [ctx] = ctxs;
    expect(ctx.hits()).toBeNull();
    expect(ctx.laps).toBe(3);
    ctx.track.record(spot_of(fujin).level, { stars: 3, ms: 1000 });
    expect(writes).toBe(0);
    expect(r.modes.can_change_car).toBe(false);
  } finally {
    localStorage.setItem = set_item;
    GYMKHANA_MODE.start = start;
  }
  expect(held_car(fujin, ["fujin"])).toBe(fujin);
  expect(held_car(preset, [])).toBe(preset);
});

test("a championship runs its stages back to back: Next goes on, a retry keeps the better stage, the total grades the event", async () => {
  const r = rig();
  const finishes: (number | null)[] = [];
  GYMKHANA_MODE.start = (_ctx, level) => {
    r.starts.push(level.id);
    const at = r.starts.length - 1;
    return { update: () => null, finished: () => (finishes[at] === undefined || finishes[at] === null ? null : { title: level.name, stars: finishes[at]!, lines: [] }), dispose: () => void r.disposed++ };
  };
  const cup = { ...capped, id: "cup-test", name: "Cup", level: "g1", stars: undefined, stages: [{ mode: "gymkhana", level: "g1" }, { mode: "gymkhana", level: "g2" }, { mode: "gymkhana", level: "g3" }] };
  const career = (r.modes as unknown as { career: Career }).career;
  const saved: Record<string, string> = {};
  const store = { getItem: (key: string) => saved[key] ?? null, setItem: (key: string, value: string) => void (saved[key] = value) };
  const kept = globalThis.localStorage;
  globalThis.localStorage = store as Storage;
  const status = elements.get("mode-status") ?? (document.getElementById("mode-status") as unknown as FakeElement);
  const next = elements.get("mode-next")!;
  const finish = (stars: number) => {
    finishes[r.starts.length - 1] = stars;
    r.modes.update(0, {} as never);
  };

  r.modes.play_event(cup);
  await settle();
  r.answer(FIRST);
  await settle();
  expect(r.starts).toEqual(["g1"]);
  expect(status.dataset.cup).toBe("Stage 1/3 · 0 pts");

  finish(3);
  expect(next.textContent).toBe("Next stage");
  expect(next.hidden).toBe(false);
  expect(career.stars["cup-test"]).toBeUndefined();
  next.click();
  expect(r.starts).toEqual(["g1", "g2"]);
  expect(status.dataset.cup).toBe("Stage 2/3 · 10 pts");

  finish(0);
  expect(next.textContent).toBe("Retry stage");
  expect(elements.get("mode-result-note")!.textContent).toBe("A stage needs 1★ to go on");
  next.click();
  expect(r.starts).toEqual(["g1", "g2", "g2"]);
  expect(status.dataset.cup).toBe("Stage 2/3 · 10 pts");

  finish(1);
  elements.get("mode-retry")!.click();
  expect(r.starts).toEqual(["g1", "g2", "g2", "g2"]);
  finish(2);
  next.click();
  expect(status.dataset.cup).toBe("Stage 3/3 · 16 pts");

  finish(3);
  expect(elements.get("mode-result-title")!.textContent).toBe("Cup · 26 pts");
  expect(next.textContent).toBe("Next event");
  expect(career.stars["cup-test"]).toBe(3);
  globalThis.localStorage = kept;
  expect(new Career(store).best(cup)).toEqual({ stars: 3, ms: 1, score: 26 });
  expect(r.car).toBe(FIRST);
  r.modes.exit();
  expect(status.dataset.cup).toBeUndefined();
});

const stages = [{ mode: "gymkhana", level: "g1" }, { mode: "gymkhana", level: "g2" }, { mode: "gymkhana", level: "g3" }];

test("a championship with a stand-in, or with a stage its streamed world refuses, does not start", async () => {
  const r = rig();
  r.modes.play_event({ ...capped, id: "cup-in", level: "g1", stages, stand_in: { map: "1C0000004", level: "g1" } });
  const streamed = rig();
  (streamed.modes as unknown as { world: { tiles: { streamed: boolean } } }).world.tiles.streamed = true;
  streamed.modes.play_event({ ...capped, id: "cup-far", level: "g1", stages });
  await settle();
  expect([r.asked, r.starts, streamed.asked, streamed.starts]).toEqual([0, [], 0, []]);
  expect(elements.get("mode-result-note")!.textContent).toBe("This mode is not on this world yet");
});

test("a stage that refuses to start mid-championship says the championship ended and its points", async () => {
  const r = rig();
  GYMKHANA_MODE.start = (_ctx, level) => {
    r.starts.push(level.id);
    return level.id === "g2" ? "No room here" : { update: () => null, finished: () => ({ title: level.name, stars: 3, lines: [] }), dispose: () => {} };
  };
  r.modes.play_event({ ...capped, id: "cup-break", level: "g1", stages });
  await settle();
  r.answer(FIRST);
  await settle();
  r.modes.update(0, {} as never);
  elements.get("mode-next")!.click();
  expect(r.starts).toEqual(["g1", "g2"]);
  expect(r.modes.active).toBe(false);
  expect(elements.get("mode-status")!.textContent).toBe("No room here · championship over at stage 2/3, 10 pts");
});

test("a speed trap event leaves out the cars its circuit excludes", async () => {
  const r = rig([{ id: "circuit", closed: true, points: [], checkpoints: [], excludes: ["bus"] }]);
  r.modes.play_event({ ...capped, mode: "race", level: "trap" });
  await settle();
  expect(r.asked).toBe(1);
  expect(r.limit?.excludes).toEqual(["bus"]);
});
