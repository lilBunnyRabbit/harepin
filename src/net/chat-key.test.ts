import { expect, test } from "bun:test";
import { opens_chat } from "./chat-key";

test("T and Enter open the chat on the road; under a result card Enter is the card's, T still the chat's", () => {
  expect(opens_chat("KeyT", false)).toBe(true);
  expect(opens_chat("Enter", false)).toBe(true);
  expect(opens_chat("Enter", true)).toBe(false);
  expect(opens_chat("KeyT", true)).toBe(true);
  expect(opens_chat("KeyE", false)).toBe(false);
});
