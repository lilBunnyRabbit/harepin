import * as THREE from "three";
import { color, tones } from "../theme/palette";
import type { World } from "../world/world";
import { STREET_BELOW } from "../worldgen/rooftops";
import { WorldKind } from "../worldgen/types";
import { lap_facts, shown, type WorldDef } from "./world-def";

const STREET_REACH = 3000;

/** The street the buildings stand on: looks only, the physics floor stays the abyss so a fall resets long before it. */
function street(world: World): THREE.Object3D {
  const y = world.buildings[0]?.y ?? Math.min(...world.road.map((p) => p.y)) - STREET_BELOW;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(STREET_REACH, STREET_REACH).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: color(tones.asphalt) }));
  plane.position.y = y;
  plane.receiveShadow = true;
  return plane;
}

// Unlisted while it is built: it loads from `?world=rooftops` only.
export const rooftops: WorldDef = {
  kind: WorldKind.ROOFTOPS,
  listed: false,
  mini: true,
  name: "Rooftops",
  pick: "A downtown loop over the city roofs",
  note: "Roof runs, drops, gaps",
  hero: "A loop over the city roofs: drop from roof to roof, jump the gaps.",
  drawing: "Drawing rooftops…",
  map_label: "rooftops",
  pads: true,
  mood: {},
  ground_puff: "grass",
  backdrop: "sky",
  facts: (f) => [...lap_facts(f, "loop"), [shown(f, (f) => String(f.gaps)), f?.gaps === 1 ? "gap to jump" : "gaps to jump"]],
  dress: (world) => [street(world)],
};
