import type * as THREE from "three";
import type { GroundPuff } from "../render/effects";
import type { MoodDelta } from "../render/lighting";
import type { World } from "../world/world";
import type { WorldFacts } from "../worldgen/facts";
import type { WorldKind } from "../worldgen/types";

/** The UI half of a world kind: menu copy, map preview text and scene dressing. */
export interface WorldDef {
  kind: WorldKind;
  name: string;
  /** Under the name in the world picker. */
  pick: string;
  /** On the Play tile and the guide card. */
  note: string;
  /** On the Play hero while driving it. */
  hero: string;
  /** World map status while the preview generates. */
  drawing: string;
  /** What the world map's aria label calls it. */
  map_label: string;
  /** The world map legend lists boost pads. */
  pads: boolean;
  /** Value and label pairs for the world map; "…" while `f` is not ready. */
  facts(f: WorldFacts | null): [string, string][];
  /** Merged over the theme's mood. */
  mood: MoodDelta;
  /** Tint of the dust the open ground throws. */
  ground_puff: GroundPuff;
  /** "sky" adds the sky dome and ring clouds; "indoor" adds neither. */
  backdrop: "sky" | "indoor";
  /** Scene pieces beyond the world view, sky and clouds. */
  dress(world: World): THREE.Object3D[];
}

export const shown = (f: WorldFacts | null, value: (f: WorldFacts) => string) => (f ? value(f) : "…");

/** Lap length, corners and jumps, the facts every world shows first. */
export function lap_facts(f: WorldFacts | null, lap: string): [string, string][] {
  return [
    [shown(f, (f) => `${(f.length / 1000).toFixed(1)} km`), lap],
    [shown(f, (f) => String(f.corners)), "corners"],
    [shown(f, (f) => String(f.jumps)), "jumps"],
  ];
}
