import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "./prefs";
import { GOALS_PAGE, TOPICS, line_of } from "./guide-topics";

describe("guide topics", () => {
  test("six topics, each with a picture and a place it leads to", () => {
    expect(TOPICS.length).toBe(6);
    for (const topic of TOPICS) {
      expect(topic.art).not.toBe("");
      expect(topic.door).not.toBe("");
    }
  });

  test("only Things to try has no page of its own: it opens the first-steps list", () => {
    expect(TOPICS.filter((topic) => topic.points.length === 0).map((topic) => topic.door)).toEqual([GOALS_PAGE]);
  });

  test("a line names the bound keys", () => {
    const rewind = TOPICS[0].points.find((point) => point.label === "Rewind and reset");
    expect(rewind && line_of(rewind, DEFAULT_SETTINGS.bindings)).not.toContain("its key");
  });
});
