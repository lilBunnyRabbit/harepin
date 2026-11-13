import { expect, test } from "bun:test";
import { EVENTS, type CareerEvent } from "../career/career";
import { event_track } from "../career/career-store";
import { Cup, MAX_STAGES, MIN_STAGES, cup_marks, cup_stars, cup_status, stage_points } from "./championship";

const STAGES = [
  { mode: "race", level: "circuit" },
  { mode: "duel", level: "v1" },
  { mode: "drift", level: "d6", name: "Chain" },
];

test("a stage scores 10 / 6 / 3 by its stars, nothing without one", () => {
  expect([0, 1, 2, 3].map(stage_points)).toEqual([0, 3, 6, 10]);
});

test("default marks: 3★ near every stage gold, 2★ about a silver each", () => {
  expect(cup_marks(3)).toEqual({ two: 15, three: 24 });
  expect(cup_marks(5)).toEqual({ two: 25, three: 40 });
  const marks = cup_marks(3);
  expect([30, 26, 24, 23, 15, 14, 3, 0].map((total) => cup_stars(total, marks))).toEqual([3, 3, 3, 2, 2, 1, 1, 0]);
});

test("a championship runs its stages in order, totals the points and grades only once done", () => {
  const cup = new Cup(STAGES);
  expect(cup.status).toBe("Stage 1/3 · 0 pts");
  expect(cup.advance()).toBe(false);
  cup.score(3);
  expect(cup.done).toBe(false);
  expect(cup.stars).toBe(0);
  expect(cup.advance()).toBe(true);
  cup.score(2);
  expect(cup.status).toBe("Stage 2/3 · 16 pts");
  cup.advance();
  expect(cup.stage.level).toBe("d6");
  cup.score(1);
  expect(cup.done).toBe(true);
  expect(cup.total).toBe(19);
  expect(cup.stars).toBe(2);
  expect(cup.advance()).toBe(false);
});

test("a retry keeps the stage's better result", () => {
  const cup = new Cup(STAGES, { two: 10, three: 20 });
  cup.score(2);
  cup.score(1);
  expect(cup.results).toEqual([2, null, null]);
  cup.score(3);
  expect(cup.total).toBe(10);
});

test("a 0-star stage holds the championship until a retry earns a star", () => {
  const cup = new Cup(STAGES);
  cup.score(0);
  expect([cup.cleared, cup.advance(), cup.index]).toEqual([false, false, 0]);
  cup.score(1);
  expect(cup.advance()).toBe(true);
  cup.score(3);
  cup.advance();
  cup.score(0);
  expect([cup.done, cup.stars]).toEqual([false, 0]);
  cup.score(3);
  expect([cup.done, cup.total, cup.stars]).toEqual([true, 23, 2]);
});

test("cup_status reads as the HUD line", () => {
  expect(cup_status(1, 3, 16)).toBe("Stage 2/3 · 16 pts");
});

test("a championship event keeps a stage's best per level in one event store", () => {
  const event: CareerEvent = { id: "cup", name: "Cup", mode: "race", level: "circuit", map: "1C0000003", car: { cap: "c" }, tuned: "3:w11", stages: STAGES };
  expect(event_track(event, null).ids).toEqual(["circuit", "v1", "d6"]);
});

test("every championship event has 3-5 stages, the first its own mode and level", () => {
  for (const event of EVENTS.filter((e) => e.stages)) {
    const stages = event.stages ?? [];
    expect([event.id, stages.length >= MIN_STAGES && stages.length <= MAX_STAGES]).toEqual([event.id, true]);
    expect([event.id, stages[0]?.mode, stages[0]?.level]).toEqual([event.id, event.mode, event.level]);
    expect([event.id, event.stand_in]).toEqual([event.id, undefined]);
  }
});
