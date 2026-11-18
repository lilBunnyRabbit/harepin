/// <reference types="bun" />
import { expect, test } from "bun:test";
import { CORNER_MODEL } from "./corner-model";
import { FEATURES } from "./corners";

test("the shipped corner model was fitted on the features predict reads, in their order", () => {
  expect(CORNER_MODEL.features).toEqual([...FEATURES]);
});
