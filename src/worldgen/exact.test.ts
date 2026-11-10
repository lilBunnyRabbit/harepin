/// <reference types="bun" />
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Engines may round these differently, so generated data takes none: each counted use is display, mesh or accepted base code.
const ALLOWED: Record<string, number> = {
  "canyon.ts": 2,
  "chunks.ts": 1,
  "deck.ts": 2,
  "facts.ts": 6,
  "index.ts": 2,
  "landmark-mesh.ts": 4,
  "landmarks.ts": 2,
  "lots.ts": 2,
  "map.ts": 4,
  "noise.ts": 1,
  "road-layers.ts": 1,
  "routes.ts": 1,
  "sky-mesh.ts": 1,
  "sky.ts": 21,
  "towns.ts": 1,
};
const INEXACT = /Math\.(hypot|acos|asin|atan2?|sin|cos|tan|pow|exp|log\w*|cbrt|sinh|cosh|tanh)\b/g;

test("worldgen takes no new inexact Math calls", () => {
  const dir = import.meta.dir;
  const found: Record<string, number> = {};
  for (const entry of readdirSync(dir, { recursive: true }) as string[]) {
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
    const count = readFileSync(join(dir, entry), "utf8").match(INEXACT)?.length ?? 0;
    if (count) found[entry.replaceAll("\\", "/")] = count;
  }
  expect(found).toEqual(ALLOWED);
});
