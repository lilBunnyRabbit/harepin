import { expect, test } from "bun:test";
import { questions_of } from "./answers";
import { shown_trials } from "./blind";
import type { Pack, Trial } from "./pack";

const trial = (id: string, extra: Partial<Trial> = {}): Trial => ({ id, car: "coupe.4.0.2.1.0", station: "skidpad", goal: { kind: "free" }, try: "", feel: `${id} feel`, ...extra });
const pack = (blind: boolean): Pack => ({ id: "p", rev: 1, title: "", brief: "", blind, trials: [trial("lead"), trial("stock", { base: true }), trial("soft"), trial("stiff"), trial("wide")], ask: [{ kind: "scale", id: "grip", label: "", low: "", high: "" }, { kind: "text", id: "note", label: "" }] });

test("a blind group shows letters, the base's feel and asks vs A; open packs keep ids", () => {
  const blind = shown_trials(pack(true));
  expect(blind[0]).toEqual({ label: "lead", feel: "lead feel", try: "", base: -1, open: true });
  expect(blind[1].label).toBe("A");
  expect(blind.slice(2).map((s) => s.label).sort()).toEqual(["B", "C", "D"]);
  expect(blind.slice(2).every((s) => s.feel === "stock feel" && s.base === 1 && !s.open)).toBe(true);
  const p = pack(true);
  expect(questions_of(p, p.trials[2]).map((q) => q.id)).toEqual(["grip", "vsbase", "note"]);
  expect(questions_of(p, p.trials[1]).map((q) => q.id)).toEqual(["grip", "note"]);
  const open = pack(false);
  expect(shown_trials(open).map((s) => s.label)).toEqual(["lead", "stock", "soft", "stiff", "wide"]);
  expect(questions_of(open, open.trials[2]).map((q) => q.id)).toEqual(["grip", "note"]);
});
