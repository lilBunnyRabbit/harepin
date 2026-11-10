import type { WorldKind } from "../worldgen/types";
import { alpine } from "./alpine";
import { desert } from "./desert";
import { island } from "./island";
import { mainland } from "./mainland";
import { sky } from "./sky";
import type { WorldDef } from "./world-def";

/** In menu order. */
export const WORLDS: Record<WorldKind, WorldDef> = { mainland, island, sky, desert, alpine };

/** The worlds a player can pick, in menu order. */
export const LISTED = Object.values(WORLDS).filter((w) => w.listed);

/** The mini maps a player can pick, in menu order. */
export const MINIS = LISTED.filter((w) => w.mini);
