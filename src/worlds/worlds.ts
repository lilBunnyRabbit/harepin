import type { WorldKind } from "../worldgen/types";
import { alpine } from "./alpine";
import { desert } from "./desert";
import { island } from "./island";
import { mainland } from "./mainland";
import { rooftops } from "./rooftops";
import { sky } from "./sky";
import { tundra } from "./tundra";
import { volcano } from "./volcano";
import type { WorldDef } from "./world-def";

/** In menu order. */
export const WORLDS: Record<WorldKind, WorldDef> = { mainland, island, sky, desert, alpine, tundra, volcano, rooftops };

/** The worlds a player can pick, in menu order. */
export const LISTED = Object.values(WORLDS).filter((w) => w.listed);

/** The mini maps a player can pick, in menu order. */
export const MINIS = LISTED.filter((w) => w.mini);
