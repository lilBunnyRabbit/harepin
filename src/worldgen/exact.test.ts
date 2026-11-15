/// <reference types="bun" />
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Engines round these differently, so generated worlds take every one from sim-math.
const INEXACT = /Math\.(hypot|acos|asin|atan2?|sin|cos|tan|pow|exp|log\w*|cbrt|sinh|cosh|tanh)\b/g;

test("worldgen takes no inexact Math calls", () => {
  const dir = import.meta.dir;
  const found: Record<string, number> = {};
  for (const entry of readdirSync(dir, { recursive: true }) as string[]) {
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
    const count = readFileSync(join(dir, entry), "utf8").match(INEXACT)?.length ?? 0;
    if (count) found[entry.replaceAll("\\", "/")] = count;
  }
  expect(found).toEqual({});
});
