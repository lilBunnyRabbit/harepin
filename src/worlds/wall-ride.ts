import { WorldKind } from "../worldgen/types";
import { velodrome } from "./velodrome";
import type { WorldDef } from "./world-def";

// The velodrome's arena dressed the same: the pipes and the wall are its own bowls taken further.
export const wall_ride: WorldDef = {
  ...velodrome,
  kind: WorldKind.WALL_RIDE,
  name: "Wall Ride",
  label: "Wall ride",
  pick: "Bowls, half-pipes and a wall above the clouds",
  note: "Velodrome bowls, half-pipes, a wall ride",
  hero: "Ride the wall: carry the speed or go over the top.",
  drawing: "Drawing wall ride…",
  map_label: "wall ride",
};
