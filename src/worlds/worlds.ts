import type { WorldKind } from "../worldgen/types";
import { desert } from "./desert";
import { island } from "./island";
import { sky } from "./sky";
import type { WorldDef } from "./world-def";

/** In menu order. */
export const WORLDS: Record<WorldKind, WorldDef> = { island, sky, desert };
