import type * as THREE from "three";
import type { GroundPuff } from "../render/effects";
import type { Kit } from "../render/prop-kit";
import type { MoodDelta } from "../render/lighting";
import type { DeckLook } from "../render/scene";
import type { World } from "../world/world";
import type { WorldFacts } from "../worldgen/facts";
import type { MapLineKind } from "../worldgen/map";
import type { WorldKind } from "../worldgen/types";
import type { Lab } from "../theme/theme";
import { brand, dark, mix, tones } from "../theme/palette";
import { sky_tones } from "../render/sky";

/** The UI half of a world kind: menu copy, map preview text and scene dressing. */
export interface WorldDef {
  kind: WorldKind;
  name: string;
  /** Shown in the Play row, world picker and guide; an unlisted kind still loads from a `?world=` link. */
  listed: boolean;
  /** A mini map: a short, focused world listed under the mainland on Play. */
  mini: boolean;
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
  /** The upland ground's tone; dry grass when unset. */
  upland?: Lab;
  /** A deck kind's own track tones; the toy track's accent when unset. */
  deck?: DeckLook;
  /** Tint of the dust the open ground throws. */
  ground_puff: GroundPuff;
  /** "sky" adds the sky dome and ring clouds; "indoor" adds neither. */
  backdrop: "sky" | "indoor";
  /** Scene pieces beyond the world view, sky and clouds. */
  dress(world: World): THREE.Object3D[];
  kit: Kit;
  /** Deck bank, radians, past which the chase view rolls with the deck so the car reads upright on a wall; unset keeps the view level. */
  wall_view?: number;
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

/** The world map's ink for each road class under the circuit: a tone and its opacity. */
export type RoadInk = Record<Exclude<MapLineKind, "circuit">, readonly [Lab, number]>;

type Look = Pick<WorldDef, "mood" | "ground_puff"> & { roads: RoadInk };

const ROADS: RoadInk = { street: [tones.sidewalk, 1], local: [brand.foreground, 0.55], highway: [brand.foreground, 0.8] };
// Dusk snow is the foreground itself, so the roads take the opposite end of the ladder to stay on it.
const snow_ink = dark ? brand.background_darkest : brand.foreground;

// A warm dusk key turned snow mauve-brown, the desert's tone; a winter dusk is lit cold, from the sky's side.
const WINTER_DUSK: MoodDelta = dark ? { key: mix(sky_tones.skylight, brand.foreground, 0.5), hemi_sky: mix(brand.info, brand.foreground, 0.35) } : {};

/** Over any world's own look under the snow kit: a bright bounce off the snow, a low sun, cold air pulling the fog in. */
const WINTER: Look = {
  mood: { hemi_ground: tones.snow, sun_y: 0.3, fog_near: 90, fog_far: 1100, ...WINTER_DUSK },
  ground_puff: "snow",
  roads: { street: [snow_ink, 0.45], local: [snow_ink, 0.6], highway: [snow_ink, 0.8] },
};

export function world_look(def: WorldDef, snowy: boolean): Look {
  return snowy ? { mood: { ...def.mood, ...WINTER.mood }, ground_puff: WINTER.ground_puff, roads: WINTER.roads } : { mood: def.mood, ground_puff: def.ground_puff, roads: ROADS };
}
