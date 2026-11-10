/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, build_code } from "./build";
import { BUILD_NAME_LENGTH, MAX_BUILDS, free_build_name, parse_builds, renamed, with_build, without_build } from "./builds";

const code = build_code(DEFAULT_BUILD);
const other = build_code({ ...DEFAULT_BUILD, car: "kaze", paint: 3 });

test("saved builds keep only named entries with a real build code", () => {
  const list = parse_builds([
    { name: "Grip", code },
    { name: "  Drift   Kaze ", code: other },
    { name: "Broken", code: "not a build" },
    { name: "", code },
    { name: "grip", code: other },
    "junk",
    null,
    { name: 3, code },
  ]);
  expect(list).toEqual([
    { name: "Grip", code },
    { name: "Drift Kaze", code: other },
  ]);
  expect(parse_builds({ name: "Grip", code })).toEqual([]);
  expect(parse_builds(null)).toEqual([]);
});

test("saved builds stop at the cap and clip long names", () => {
  const many = Array.from({ length: MAX_BUILDS + 5 }, (_, i) => ({ name: `Build ${i}`, code }));
  expect(parse_builds(many)).toHaveLength(MAX_BUILDS);
  expect(parse_builds([{ name: "x".repeat(BUILD_NAME_LENGTH + 10), code }])[0].name).toHaveLength(BUILD_NAME_LENGTH);
});

test("saving a name again replaces it and moves it to the top", () => {
  const list = with_build([{ name: "A", code }, { name: "B", code }], "a", other);
  expect(list).toEqual([
    { name: "a", code: other },
    { name: "B", code },
  ]);
  expect(with_build([], "  ", code)).toBeNull();
  expect(with_build([], "Bad", "nope")).toBeNull();
});

test("rename refuses a taken or empty name, delete removes one", () => {
  const list = [
    { name: "A", code },
    { name: "B", code: other },
  ];
  expect(renamed(list, "A", "b")).toBeNull();
  expect(renamed(list, "A", " ")).toBeNull();
  expect(renamed(list, "A", "a")).toEqual([
    { name: "a", code },
    { name: "B", code: other },
  ]);
  expect(without_build(list, "A")).toEqual([{ name: "B", code: other }]);
});

test("a free name counts up from the car's name", () => {
  expect(free_build_name([], "Kaze")).toBe("Kaze");
  expect(free_build_name([{ name: "kaze", code }, { name: "Kaze 2", code }], "Kaze")).toBe("Kaze 3");
});
