import "../../scripts/fake-dom";
import { describe, expect, test } from "bun:test";
import { render } from "svelte/server";
import { parse_build } from "../car/build";
import BuildCard from "./BuildCard.svelte";
import { MAX_CARDS, build_summary, chat_builds } from "./build-link";

const codes = (text: string) => chat_builds(text).map((each) => each.code);

function summary_of(code: string) {
  const build = parse_build(code);
  if (!build) throw new Error(`${code} no longer parses`);
  return build_summary(build);
}

describe("chat_builds", () => {
  test("finds a bare code and a link's ?car= code, each once", () => {
    expect(codes("try hatch.4.0.2.1.0 it's calm")).toEqual(["hatch.4.0.2.1.0"]);
    expect(codes("(hatch.4.0.2.1.0).")).toEqual(["hatch.4.0.2.1.0"]);
    expect(codes("https://example.com/harepin/?seed=3&car=formula.6.4.4.2.2.0.1.2.2.2.1.2 go")).toEqual(["formula.6.4.4.2.2.0.1.2.2.2.1.2"]);
    expect(codes("hatch.4.0.2.1.0 hatch.4.0.2.1.0")).toEqual(["hatch.4.0.2.1.0"]);
  });

  test("ignores anything parse_build refuses", () => {
    expect(codes("hatch.4.0.2.1")).toEqual([]);
    expect(codes("tank.4.0.2.1.0")).toEqual([]);
    expect(codes("hatch.99.0.2.1.0")).toEqual([]);
    expect(codes("<b>hatch.4.0.2.1.0</b>")).toEqual([]);
    expect(codes("javascript:alert(1)?car=hatch.4.0.2.1.0")).toEqual([]);
    expect(codes("https://example.com/?car=nope")).toEqual([]);
    expect(codes("https://[bad")).toEqual([]);
  });

  test(`at most ${MAX_CARDS} cards a message`, () => {
    expect(codes("hatch.1.0.2.1.0 hatch.2.0.2.1.0 hatch.3.0.2.1.0")).toHaveLength(MAX_CARDS);
  });
});

describe("BuildCard", () => {
  test("shows the car, its rating, the changed parts and a Use button", () => {
    const summary = summary_of("hatch.4.0.2.1.0");
    expect(summary.parts).toEqual(["Aero kit: Wing"]);
    const html = render(BuildCard, { props: { build: summary, onuse: () => {} } }).body;
    expect(html).toContain(summary.car);
    expect(html).toContain(`PI ${summary.rating.pi}`);
    expect(html).toContain("Aero kit: Wing");
    expect(html).toContain("Use build");
  });

  test("a stock build says so", () => {
    expect(render(BuildCard, { props: { build: summary_of("hatch.4.0.0.1.0"), onuse: () => {} } }).body).toContain("Stock parts");
  });
});
