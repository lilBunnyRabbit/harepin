import { find_site } from "../modes/gymkhana";
import { MODES } from "../modes/modes";
import { park_footprint } from "../modes/parking";
import type { World } from "../world/world";
import { KINDS } from "../worldgen/kinds/kinds";
import { SPAWN_INDEX } from "../worldgen/types";
import type { RunProbe } from "./runs";

const PARK_AREA = park_footprint();

/** The modes' own refusals, read before a run starts: no open ground, a streamed world, no flat site near the start. */
export function probe(world: World): RunProbe {
  return {
    levels(mode) {
      const def = MODES.find((m) => m.id === mode);
      if (!def) return [];
      if (def.needs_ground && !KINDS[world.kind].open_ground) return [];
      if (world.tiles.streamed && !def.streams) return [];
      if (mode === "gymkhana" && !find_site(world, SPAWN_INDEX)) return [];
      if (mode === "parking" && !find_site(world, SPAWN_INDEX, PARK_AREA)) return [];
      return def.levels(world).map((level) => level.id);
    },
    length(level) {
      return world.routes.find((route) => route.id === level)?.length ?? null;
    },
  };
}
