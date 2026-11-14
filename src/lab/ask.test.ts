import { expect, test } from "bun:test";
import { with_station_asks } from "./ask";
import type { Trial } from "./pack";

const trial = (id: string, station: Trial["station"]): Trial => ({ id, car: "hatch.4.0.2.1.0", station, goal: { kind: "free" }, try: "", feel: "" });

test("drift ease where sliding is the point, landing on the kickers, vs last only after the same station", () => {
  const asked = with_station_asks([trial("a", "skidpad"), trial("b", "skidpad"), trial("c", "kicker"), trial("d", "runway")]).map((t) => t.ask?.map((q) => q.id));
  expect(asked).toEqual([
    ["grip", "pred", "fun", "drift", "note"],
    ["grip", "pred", "fun", "drift", "vs", "note"],
    ["grip", "pred", "fun", "land", "note"],
    ["grip", "pred", "fun", "note"],
  ]);
});
