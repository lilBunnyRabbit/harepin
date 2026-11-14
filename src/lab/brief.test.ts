import { describe, expect, test } from "bun:test";
import { shown_trials } from "./blind";
import { change_summary, change_text, comparisons, trial_brief } from "./brief";
import { resolve_pack } from "./pack";
import drift from "./packs/t2-drift";
import power from "./packs/t3a-sturm-power";
import pads from "./packs/t1a-pads";

const briefs = (pack: typeof power) => {
  const trials = resolve_pack(pack);
  const shown = shown_trials(pack);
  return pack.trials.map((_, i) => trial_brief(pack, trials, shown, i));
};

describe("trial brief", () => {
  test("a top-tier variant names the part it swaps and the class it moves to", () => {
    const [best, sc, , twin] = briefs(power);
    expect(best.baseline).toBe(true);
    expect(best.against).toBe(-1);
    expect(sc.against).toBe(0);
    expect(sc.changes.map(change_text)).toEqual(["Engine: Supercharger instead of Race"]);
    expect(twin.changes.map(change_text)).toEqual(["Engine: Twin turbo instead of Race"]);
    expect(twin.pi).toMatch(/^\S+ \d+ to \S+ \d+$/);
  });

  test("a mod that is no part reads as a field change; each place starts its own group", () => {
    const b = briefs(drift);
    expect(b[1].changes.map(change_text)).toEqual(["Rear grip −8%"]);
    expect(b[4].baseline).toBe(true);
  });

  test("a lineup reads each trial against the one before on the same station", () => {
    const b = briefs(pads);
    expect(b[0].against).toBe(-1);
    expect(b[1].against).toBe(0);
    expect(b[1].changes.map(change_text)).toEqual([`Lane: ${pads.trials[1].lane} instead of ${pads.trials[0].lane}`]);
  });

  test("the pack card lists each base and what reads against it", () => {
    const groups = comparisons(power, shown_trials(power));
    expect(groups.map((g) => g.base)).toEqual([0, 5]);
    expect(groups[0].rest).toEqual([1, 2, 3, 4]);
    expect(change_summary(briefs(power)[4].changes)).toBe("Twin turbo +3");
  });
});
