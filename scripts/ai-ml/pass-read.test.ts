import { describe, expect, test } from "bun:test";
import { Phase } from "../../src/lab/pass-trace";
import { pass_table, phase_table, read_passes, side_of } from "./pass-read";

const BLOCK = `#lab ai-pass r1 v0.55.0 2026-11-17T10:00Z keys 1440x900
#trial s1 coupe.4.0.0.1.0 spec#220cc6ee pi538B 1C0000001/circuit field=6x3/3:normal race done tcs=on
 m time=236 top=167 offs=0 resets=0
 f P1 you 236.1 +0
 passes 2 2 2 5847.3 2
 p 84.7 made car=1 lap=1 at=2429.2 braking r=-16 you=25.5/-1.3/0/0.25 ai=24.5/1.2/1/0 gap=-8.5/6.2 side=3.38
 p 172.4 lost car=0 lap=1 at=4106 straight r=999 you=13.4/0.2/0/0.4 ai=19.2/5.9/0/0.55 gap=14/- side=1.96
 ft 0 -6,4.2,0,1,0 -13.9,-0.2,0,1,0 -22,4.9,0,1,0
 ft 0.51 -5.1,4.2,3,1,0 -13.1,-0.2,2.9,1,0 -21.4,4.9,2.6,1,0
 a where="under braking"
#trial s0 coupe.4.0.0.1.0 spec#220cc6ee pi538B 1C0000000/circuit field=6x3/3:normal race skipped
#end 1/2 trials`;

describe("pass export", () => {
  test("reads every pass and grid sample of a race trial, quoted in a chat or not", () => {
    for (const text of [BLOCK, BLOCK.replaceAll("\n", "\r\n"), BLOCK.split("\n").map((l) => `> ${l}`).join("\n")]) {
      const [trial, ...more] = read_passes(text);
      expect(more).toHaveLength(0);
      expect(trial).toMatchObject({ pack: "ai-pass", rev: 1, id: "s1", car: "coupe.4.0.0.1.0", place: "1C0000001/circuit", status: "done", ai_cars: 2, lap_m: 5847.3, hz: 2, full: false });
      expect(trial.passes[0]).toEqual({ t: 84.7, made: true, car: 1, lap: 1, at: 2429.2, phase: Phase.BRAKING, radius: -16, you: { v: 25.5, lat: -1.3, throttle: 0, brake: 0.25 }, ai: { v: 24.5, lat: 1.2, throttle: 1, brake: 0 }, before: -8.5, after: 6.2, side: 3.38 });
      expect(trial.passes[1]).toMatchObject({ made: false, radius: null, before: 14, after: NaN });
      expect(trial.samples).toHaveLength(2);
      expect(trial.samples[1].cars[2]).toEqual({ s: -21.4, lat: 4.9, v: 2.6, throttle: 1, brake: 0 });
    }
  });

  test("names the side the player ran: left of the AI car in a right-hander is the outside", () => {
    const [trial] = read_passes(BLOCK);
    expect(trial.passes.map(side_of)).toEqual(["outside", "left"]);
    expect(pass_table(trial).split("\n")).toHaveLength(4);
    expect(phase_table(trial)).toContain("| braking | 1 | 0 | 1.0 |");
  });

  test("a paste cut short fails with the line it stopped on", () => {
    expect(() => read_passes(BLOCK.split("\n").slice(0, 8).join("\n"))).toThrow("a cut paste");
    expect(() => read_passes(BLOCK.replace("car=1", "car=7"))).toThrow("export line 6: AI car 7 outside 0-1");
  });
});
