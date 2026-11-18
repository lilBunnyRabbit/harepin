import { expect, test } from "bun:test";
import { ChangeKind, type Release } from "../changelog";
import { day_label, release_days, tally, timeline_of } from "./release-days";

const { NEW, IMPROVED, FIXED } = ChangeKind;
const at = (version: string, date: string): Release => ({ version, date, title: `R ${version}`, changes: [{ kind: NEW, text: "One" }] });
const LOG = [at("0.5.0", "2026-11-18"), at("0.4.1", "2026-11-17"), at("0.4.0", "2026-11-17"), at("0.3.0", "2026-11-16"), at("0.2.0", "2026-11-17")];

test("releases group by day, newest day first and newest version first within it", () => {
  expect(release_days(LOG).map((day) => [day.date, day.releases.map((r) => r.version)])).toEqual([
    ["2026-11-18", ["0.5.0"]],
    ["2026-11-17", ["0.4.1", "0.4.0", "0.2.0"]],
    ["2026-11-16", ["0.3.0"]],
  ]);
});

test("days read today, yesterday, then weekday and date", () => {
  const now = new Date(2026, 10, 18, 23, 30);
  expect(day_label("2026-11-18", now)).toBe("Today");
  expect(day_label("2026-11-17", now)).toBe("Yesterday");
  expect(day_label("2026-11-14", now)).toBe("Sat 14 Nov");
});

test("the timeline leads with the newest release and marks what came after the last one played", () => {
  const timeline = timeline_of(LOG, "0.4.0", "0.5.0");
  expect(timeline.latest?.version).toBe("0.5.0");
  expect(timeline.days.flatMap((day) => day.releases).map((r) => r.version)).toEqual(["0.4.1", "0.4.0", "0.2.0", "0.3.0"]);
  expect([...timeline.fresh]).toEqual(["0.5.0", "0.4.1"]);
  expect(timeline.seen?.version).toBe("0.4.0");
  expect(timeline_of(LOG, null, "0.5.0").seen).toBeNull();
  expect(timeline_of(LOG, "0.5.0", "0.5.0").fresh.size).toBe(0);
});

test("a tally counts changes by kind and leaves out kinds with none", () => {
  const release: Release = { ...at("1.0.0", "2026-11-18"), changes: [{ kind: FIXED, text: "a" }, { kind: NEW, text: "b" }, { kind: FIXED, text: "c" }] };
  expect(tally(release)).toEqual([{ kind: NEW, count: 1 }, { kind: FIXED, count: 2 }]);
  expect(tally(release).some((t) => t.kind === IMPROVED)).toBe(false);
});
