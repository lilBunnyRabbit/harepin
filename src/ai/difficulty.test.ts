import { expect, test } from "bun:test";
import { at_difficulty, Difficulty } from "./difficulty";
import { field_personalities, personalities } from "./field";

test("normal leaves the drawn field as it is; easy is slower and sloppier, hard faster and cleaner", () => {
  const drawn = personalities(4, 6);
  expect(at_difficulty(drawn, Difficulty.NORMAL)).toEqual(drawn);
  const easy = at_difficulty(drawn, Difficulty.EASY);
  const hard = at_difficulty(drawn, Difficulty.HARD);
  drawn.forEach((p, i) => {
    expect(easy[i].pace).toBeLessThan(p.pace);
    expect(easy[i].mistakes).toBeGreaterThan(p.mistakes);
    expect(hard[i].pace).toBeGreaterThan(p.pace);
    expect(hard[i].mistakes).toBeLessThan(p.mistakes);
    expect(hard[i].aggression).toBe(p.aggression);
  });
  expect(at_difficulty([{ ...drawn[0], mistakes: 0.9 }], Difficulty.EASY)[0].mistakes).toBe(1);
});

test("a mixed field draws each car as a field of its levels would", () => {
  const mixed = field_personalities(9, [{ aggression: 1, mistakes: 5 }, { aggression: 5, mistakes: 1 }]);
  expect(mixed[0]).toEqual(personalities(9, 2, 1, 5)[0]);
  expect(mixed[1]).toEqual(personalities(9, 2, 5, 1)[1]);
});
