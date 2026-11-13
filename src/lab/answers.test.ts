import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { answers_key, read_answers, TEXT_MAX } from "./answers";
import type { Pack } from "./pack";
import Scale from "./Scale.svelte";

const pack: Pack = {
  id: "t",
  rev: 2,
  title: "t",
  brief: "t",
  trials: [
    { id: "a", car: "hatch.4.0.2.1.0", station: "hub", goal: { kind: "free" }, try: "", feel: "" },
    { id: "b", car: "hatch.4.0.2.1.0", station: "hub", goal: { kind: "free" }, try: "", feel: "", ask: [{ kind: "pick", id: "vs", label: "vs last", options: ["worse", "same", "better"] }] },
  ],
  ask: [
    { kind: "scale", id: "grip", label: "Grip", low: "l", high: "h" },
    { kind: "text", id: "note", label: "Note" },
  ],
};

test("stored answers keep only known trials, questions and values they take", () => {
  const raw = { a: { grip: 4, note: "fine", extra: 1 }, b: { vs: "better", grip: 3 }, gone: { grip: 2 } };
  expect(read_answers(pack, raw)).toEqual({ a: { grip: 4, note: "fine" }, b: { vs: "better" } });
  expect(read_answers(pack, { a: { grip: 6, note: "  " }, b: { vs: "much" } })).toEqual({});
  expect(read_answers(pack, { a: { grip: 2.5 } })).toEqual({});
  expect(read_answers(pack, null)).toEqual({});
  expect(read_answers(pack, "x")).toEqual({});
  expect((read_answers(pack, { a: { note: "x".repeat(TEXT_MAX + 50) } }).a.note as string).length).toBe(TEXT_MAX);
});

test("answers key on pack and rev", () => {
  expect(answers_key(pack)).toBe("harepin.lab.t.r2");
});

test("a scale is five buttons with its ends", () => {
  const html = render(Scale, { props: { label: "Grip", low: "slides", high: "glued", value: 3, onchange: () => {} } }).body;
  expect(html.match(/role="radio"/g)?.length).toBe(5);
  expect(html).toContain('aria-checked="true">3<');
  expect(html).toContain("slides");
  expect(html).toContain("glued");
});
