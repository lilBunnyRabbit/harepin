import type { WorldKind } from "../worldgen/types";
import { desert } from "./desert";
import { island } from "./island";
import { mainland } from "./mainland";
import { sky } from "./sky";
import type { WorldDef } from "./world-def";

/** In menu order. */
export const WORLDS: Record<WorldKind, WorldDef> = { island, sky, desert, mainland };

/** The worlds a player can pick, in menu order. */
export const LISTED = Object.values(WORLDS).filter((w) => w.listed);
