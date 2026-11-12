import type { Biome, TreeRule } from "./biomes";
import type { FallsRecipe } from "./falls";
import type { IceRecipe } from "./ice";
import { SNOW_KIT, type SnowKit } from "./snow";
import { Ground, PropKind, SurfaceId, type ItemKind } from "./types";

/** Exact shaping powers: integer powers and nested square roots, never a float exponent, so every engine agrees. */
export type Power = 1 | 1.75 | 2 | 3;

/** Adds `height` metres everywhere. */
export interface LiftLayer {
  kind: "lift";
  height: number;
}

/** Adds fbm noise `scale` metres across, raised to `power`, times `amp` metres. `seed` offsets the world seed. */
export interface FbmLayer {
  kind: "fbm";
  scale: number;
  seed: number;
  octaves: number;
  power: Power;
  amp: number;
}

/** Adds ridged fbm (crests where the noise crosses its middle), `scale` metres along x and `scale / stretch` along z. */
export interface RidgedLayer {
  kind: "ridged";
  scale: number;
  stretch: number;
  seed: number;
  octaves: number;
  power: Power;
  amp: number;
}

/** Adds one seeded mountain `height` metres tall, `radius` wide, its top within `reach` of the centre. */
export interface PeakLayer {
  kind: "peak";
  height: number;
  radius: number;
  reach: number;
}

/**
 * A crater in the middle of the map, rim `radius` metres out. Inside `floor` of the radius the ground lies flat, `depth`
 * metres under the mean height of the layers before it round the rim; the wall climbs back to the land at the rim, which
 * stands `lip` metres proud, easing to nothing `lip_width` metres either side of it. Lava fills the floor `lava` metres
 * deep; 0 leaves it dry.
 */
export interface CraterLayer {
  kind: "crater";
  radius: number;
  floor: number;
  depth: number;
  lip: number;
  lip_width: number;
  lava: number;
}

/** Cuts land above `base` into terraces `step` high, with risers `riser` of a step wide. */
export interface TerraceLayer {
  kind: "terrace";
  base: number;
  step: number;
  riser: number;
}

/** Fades the land to `edge` metres past `radius` from the centre; the shore wobbles `wobble` of the radius over `scale` metre noise. */
export interface MaskLayer {
  kind: "mask";
  radius: number;
  edge: number;
  scale: number;
  seed: number;
  wobble: number;
}

/**
 * A slip face at repose: straight down at `grade` from a brink rounded over `brink` metres to a toe, then `floor`
 * metres of flat interdune corridor and a straight windward rise; the corridor's ends are rounded over `toe` metres, so
 * `floor` is at least `toe`. Smaller bands lie down on the slip face, as ripples do on a real one.
 */
export interface DuneFace {
  grade: number;
  brink: number;
  toe: number;
  floor: number;
}

/**
 * Where the circuit crosses dunes `above` metres tall the dunes part: flat `width` metres either side of the crossing,
 * back to full height `ease` metres further out. `at` is filled from the planned circuit.
 */
export interface DuneGaps {
  above: number;
  width: number;
  ease: number;
  at: readonly (readonly (readonly [number, number])[])[];
}

/** One wavelength of dunes: crests `wave` metres apart, `height` tall, the steep lee face taking `lee` of each wave. */
export interface DuneBand {
  wave: number;
  height: number;
  /** Share of the wave the smoothstep lee face takes; a `face` sets its own from height and grade. */
  lee: number;
  face?: DuneFace;
  /** Waves the crests bend by over noise; absent = the dune sea's. */
  bend?: number;
  /** False lays the band over the whole map instead of in fields that come and go. */
  fields?: boolean;
}

/** Dune crests across a seeded wind, one of 16 headings: gentle windward slopes, steep lee faces, broken into fields by noise. */
export interface DunesLayer {
  kind: "dunes";
  seed: number;
  bands: readonly DuneBand[];
  gaps?: DuneGaps;
}

/**
 * Fills the lowest `share` of the map flat, eased over `blend` metres: pans in the low ground between the dunes. The level
 * is that share's height on a coarse sample of the layers before it, so every seed gets about the same pan area.
 */
export interface PanLayer {
  kind: "pan";
  share: number;
  blend: number;
}

/**
 * Passes centred `at` metres along the range from its middle, each dipping the crest by `depth` of its height: flat for
 * `floor` metres either side, rising back to the full crest by `width`. The circuit is planned over the recipe's `at`;
 * the generator then moves the passes to where it crosses the crest.
 */
export interface Saddle {
  at: readonly number[];
  depth: number;
  floor: number;
  width: number;
}

/**
 * A mountain range through the middle along a seeded heading, one of 16: `height` tall at the crest, falling to nothing
 * `width` metres either side, the crest meandering `meander` metres. Ridged noise saws `saw` of its height into teeth.
 */
export interface RangeLayer {
  kind: "range";
  seed: number;
  height: number;
  width: number;
  meander: number;
  saw: number;
  saddle: Saddle;
}

/** A point layer: a pure function of position, seed and the height so far, so any tile can rebuild it alone. */
export type TerrainLayer = LiftLayer | FbmLayer | RidgedLayer | PeakLayer | CraterLayer | TerraceLayer | MaskLayer | DunesLayer | PanLayer | RangeLayer;

/** Point layers folded in order over a height starting at 0. */
export type TerrainRecipe = readonly TerrainLayer[];

/** A biome's ground row: `above` where its patch noise passes `cut`, else `below`; `soft` dithers the cut that wide. */
export interface GroundRule {
  cut: number;
  above: Ground;
  below: Ground;
  soft: number;
}

/** Props strewn over open ground: one at most per `spacing` cell, on `odds` of the cells in `biomes`. */
export interface ScatterRule {
  kind: PropKind;
  spacing: number;
  odds: number;
  biomes: readonly Biome[];
  /** Only this close to a road, metres; Infinity strews them anywhere. */
  road_within: number;
}

/** Where each biome sits: coast under a wobbling shore height, then inland bands cut from the biome score field. */
export interface ZoneRecipe {
  /** Land under `top` metres, wobbled `wobble` metres over `scale` metre noise, is coast. */
  coast: { top: number; wobble: number; scale: number };
  /** Inland biomes from low score to high, each given an equal share of the land. */
  bands: readonly Biome[];
}

/** Heights and slopes (the up component of the ground normal) where the ground gives way to sand, rock and snow. */
export interface GroundLimits {
  /** Sand under this height, whatever the biome. */
  beach: number;
  /** Ground half-way to rock below `up` or above `height`. */
  scree: { up: number; height: number };
  rock: { up: number; height: number };
  snow_line: number;
  /** Trees grow between these heights. */
  tree_floor: number;
  tree_line: number;
  /** The ground row a pan layer's floor lays, whatever the biome. */
  pan: Ground | null;
  /** The surface laid on ground over the scree height, where it paints half-way to rock and up; null lays none. */
  loose: SurfaceId | null;
}

export interface BiomeRecipe {
  /** Ground rows that lay a surface of their own under the wheels. */
  surfaces: Partial<Record<Ground, SurfaceId>>;
  zones: ZoneRecipe;
  limits: GroundLimits;
  rules: Record<Biome, TreeRule>;
  items: Record<Biome, ItemKind | null>;
  ground: Record<Biome, GroundRule>;
}

/**
 * Past the flat band, ground eases to terrain over `run` metres per metre of height between them, out to `reach` metres
 * past the road's half. Smoothstep's steepest grade is 1.5 times its mean, so run 3.75 keeps a bank under 1:2.5.
 */
export interface Bank {
  run: number;
  reach: number;
}

/** A road kicker's toe needs the circuit before it to fall no steeper than `grade` over `reach` metres: braking down a steep run-up for the lip puts a car off the road. */
export interface Runup {
  grade: number;
  reach: number;
}

/** A one-way road off the ring down to ground under `outlet`: a stack of the first of `stacks` hairpins that fits, then a gully. */
export interface DescentRecipe {
  stacks: readonly number[];
  outlet: number;
  tries: number;
  /** Car ids the descent race leaves out. */
  excludes?: readonly string[];
  /** Par share of the descent over the autopilot estimate, fitted to scripts/races.ts; absent = the shared one. */
  par?: number;
  /**
   * The gully's bed as bare ground instead of road: level `half` metres either side of the line, held within `bank`,
   * laid as `surface`. The road stops where the gully takes over. Absent = road all the way down.
   */
  bed?: { surface: SurfaceId; half: number; bank: Bank; radius: number; stride: number; falls: FallsRecipe; pads: SurfaceId };
}

export interface RoadRecipe {
  /** Ring control radius: base plus noise times swing, clamped to min..max. */
  loop: { radius: number; swing: number; min: number; max: number };
  /** Every this-many ring controls is a corner and the road runs straight between them; null keeps the round ring. */
  straights: number | null;
  /** Hairpin counts the summit stack tries, most first. */
  stacks: readonly number[];
  /** With no stack built, the ring bends a tongue toward the summit; false keeps the ring as it is. */
  tongue: boolean;
  /**
   * The canyon runs down to ground under `outlet` metres; null = no canyon. Its planner draws up to `tries` descents, and
   * the trail tries up to `crossings` places to jump it.
   */
  canyon: { outlet: number; tries: number; crossings: number } | null;
  kickers: { road: number; total: number; big: number };
  /** Null puts a road kicker after any descent the road allows. */
  runup: Runup | null;
  /** Cut and fill banks wider than the fixed shoulder; null keeps the shoulder. */
  bank: Bank | null;
  descent?: DescentRecipe;
  /** Par share of the circuit (both ways) over the autopilot estimate, fitted to scripts/races.ts; absent = the shared one. */
  lap_par?: number;
  /** False keeps the trails for free roam but races none of them: on the volcano's flank not every car finishes one. */
  trail_races?: boolean;
  /** False races no street routes: where a missed town corner puts a car in loose sand, not every car gets out. */
  street_races?: boolean;
  /** Car ids the circuit races (both ways) leave out. */
  lap_excludes?: readonly string[];
  /**
   * Lays the circuit along two neighbouring corridors of the dunes, `half` metres either side of the middle, joined by
   * a half circle over the dune between them at each end; replaces the ring. `wind` is the seed of the dune layer it
   * reads the wind of.
   */
  corridor?: { half: number; wind: number };
}

export interface TownRecipe {
  min: number;
  max: number;
  /** Gardens and house yards get trees; false gives them a water tank and boulders instead. */
  trees: boolean;
  /** Share of those trees that are pines; the rest are broadleaf. */
  pines: number;
  /** Street block size: min plus up to span, metres. */
  block: { min: number; span: number };
  /** Highest ground a town centre sits on, metres. */
  top: number;
  /** A street grid, or one main street along the slope's contour with a lane off its middle: a mountain village. */
  layout: "grid" | "strip";
  /** "flat" puts a flat roof on every building (adobe outposts), "steep" a steep gable on every house and small shop. */
  roofs: "mixed" | "flat" | "steep";
  /** Each town picks its own lot width, height and wall tone; false builds every town alike. */
  variety: boolean;
  /** Also test lot rectangles against each other and their corners' road_dist between vertices; false keeps the vertex test alone. */
  exact: boolean;
  /** Only where the whole town lies on a pan's floor. */
  pan?: boolean;
}

/** Rivers down the `count` biggest drainage basins, from where `head` plan cells drain into them; lakes in basins `depth` deep and `min`-`max` plan cells wide. */
export interface WaterRecipe {
  rivers: { count: number; head: number; width: readonly [number, number]; depth: readonly [number, number] };
  lakes: { count: number; depth: number; min: number; max: number };
}

export const Landmark = { MAST: "mast", LIGHTHOUSE: "lighthouse", TURBINES: "turbines", ARCH: "arch" } as const;
export type Landmark = (typeof Landmark)[keyof typeof Landmark];

/** A land kind's tuning. Part of the kind's version: changing a value bumps it. */
export interface Recipe {
  terrain: TerrainRecipe;
  biomes: BiomeRecipe;
  road: RoadRecipe;
  towns: TownRecipe;
  landmarks: readonly Landmark[];
  scatter: readonly ScatterRule[];
  /** Lakes and rivers planned on a streamed kind's plan grid; left out = the sea only. */
  water?: WaterRecipe;
  /** Laid over the finished ground: winter. Left out = no snow but over the snow line. */
  snow?: SnowKit;
  ice?: IceRecipe;
}

const LIFT: LiftLayer = { kind: "lift", height: 5 };
/** Alpine valleys sit well over the floor, so the negative ridges never cut below it. */
const VALLEY_FLOOR: LiftLayer = { kind: "lift", height: 30 };

function hills(amp: number): FbmLayer {
  return { kind: "fbm", scale: 520, seed: 7, octaves: 5, power: 1.75, amp };
}

function ridges(amp: number): RidgedLayer {
  return { kind: "ridged", scale: 300, stretch: 1, seed: 11, octaves: 5, power: 3, amp };
}

function shore(radius: number, edge: number): MaskLayer {
  return { kind: "mask", radius, edge, scale: 380, seed: 3, wobble: 0.3 };
}

const HARDPACK: BiomeRecipe["surfaces"] = { [Ground.DIRT]: SurfaceId.DIRT };
const ZONES: ZoneRecipe = { coast: { top: 6, wobble: 5, scale: 90 }, bands: ["meadow", "forest", "upland"] };
const LIMITS: GroundLimits = { beach: 2.2, scree: { up: 0.8, height: 120 }, rock: { up: 0.7, height: 135 }, snow_line: 165, tree_floor: 3, tree_line: 125, pan: null, loose: null };

export const ISLAND: Recipe = {
  terrain: [LIFT, hills(95), ridges(22), { kind: "peak", height: 150, radius: 430, reach: 220 }, shore(960, -9)],
  biomes: {
    surfaces: HARDPACK,
    zones: ZONES,
    limits: LIMITS,
    rules: {
      coast: { start: 0.5, fill: 0.12, pine: 0.2, scrub: 0.6, extra: 0 },
      meadow: { start: 0.52, fill: 0.3, pine: 0.15, scrub: 0.1, extra: 0 },
      forest: { start: 0.45, fill: 1, pine: 0.88, scrub: 0, extra: 1 },
      upland: { start: 0.3, fill: 0.22, pine: 0.05, scrub: 0.75, extra: 0 },
    },
    items: { coast: "log", meadow: "hay", forest: "log", upland: "rock" },
    ground: {
      coast: { cut: 0.55, above: Ground.SAND, below: Ground.DUNE, soft: 0 },
      meadow: { cut: 0.55, above: Ground.DRY, below: Ground.GRASS, soft: 0 },
      forest: { cut: 0.6, above: Ground.GRASS, below: Ground.FOREST, soft: 0 },
      upland: { cut: 0.5, above: Ground.DRY, below: Ground.UPLAND, soft: 0 },
    },
  },
  road: { loop: { radius: 620, swing: 640, min: 380, max: 860 }, straights: null, stacks: [4, 2], tongue: true, canyon: { outlet: 2, tries: 64, crossings: 4 }, kickers: { road: 4, total: 12, big: 3 }, runup: null, bank: null },
  towns: { min: 3, max: 6, trees: true, pines: 0.5, block: { min: 45, span: 25 }, top: 60, layout: "grid", roofs: "mixed", variety: false, exact: true },
  landmarks: [Landmark.MAST, Landmark.LIGHTHOUSE, Landmark.TURBINES, Landmark.ARCH],
  scatter: [],
};

const BARE = { start: 1, fill: 0, pine: 0, scrub: 0, extra: 0 };
/** Dither width of the dune sea's patch edges, so the two sand tones fray into each other instead of a hard camouflage line. */
const SOFT = 0.3;
/** Share of the map the pans fill and their ease; the floor is the pale PAN row, laid as hardpack. */
const PAN: PanLayer = { kind: "pan", share: 0.2, blend: 3 };

/** Wind-aligned dune crests to the horizon, pale hardpack pans between them, a few adobe outposts inside a dune wall. */
export const DESERT: Recipe = {
  terrain: [
    LIFT,
    { kind: "fbm", scale: 700, seed: 7, octaves: 4, power: 2, amp: 44 },
    // Past the mask the land rises to a dune wall instead of falling to a sea floor.
    shore(960, 42),
    {
      kind: "dunes",
      seed: 17,
      bands: [
        { wave: 280, height: 16, lee: 0.18 },
        { wave: 70, height: 3, lee: 0.2 },
      ],
    },
    PAN,
  ],
  biomes: {
    surfaces: { [Ground.PAN]: SurfaceId.HARDPACK },
    zones: ZONES,
    limits: { ...LIMITS, pan: Ground.PAN },
    rules: { coast: BARE, meadow: BARE, forest: BARE, upland: BARE },
    items: { coast: "rock", meadow: "rock", forest: null, upland: "rock" },
    ground: {
      coast: { cut: 0.55, above: Ground.DUNE, below: Ground.DUNE, soft: 0 },
      meadow: { cut: 0.55, above: Ground.UPLAND, below: Ground.DUNE, soft: SOFT },
      forest: { cut: 0.6, above: Ground.DUNE, below: Ground.UPLAND, soft: SOFT },
      upland: { cut: 0.5, above: Ground.UPLAND, below: Ground.DUNE, soft: SOFT },
    },
  },
  road: { loop: { radius: 650, swing: 500, min: 420, max: 850 }, straights: 4, stacks: [], tongue: false, canyon: { outlet: 24, tries: 24, crossings: 1 }, kickers: { road: 4, total: 16, big: 4 }, runup: null, bank: null },
  towns: { min: 1, max: 3, trees: false, pines: 0.5, block: { min: 35, span: 15 }, top: 60, layout: "grid", roofs: "flat", variety: false, exact: false },
  landmarks: [Landmark.MAST, Landmark.TURBINES],
  scatter: [
    { kind: PropKind.CACTUS, spacing: 46, odds: 0.05, biomes: ["meadow", "upland"], road_within: Infinity },
    { kind: PropKind.BOULDER, spacing: 70, odds: 0.06, biomes: ["meadow", "forest", "upland"], road_within: Infinity },
    { kind: PropKind.WIND_PUMP, spacing: 120, odds: 0.15, biomes: ["coast", "meadow", "forest", "upland"], road_within: 40 },
  ],
};

/** The island's ground at three times the span: one wide landmass in the sea, its towns joined by a road network. */
export const MAINLAND: Recipe = {
  ...ISLAND,
  terrain: [LIFT, hills(110), ridges(26), { kind: "peak", height: 240, radius: 1100, reach: 1400 }, shore(2900, -9)],
  towns: { min: 10, max: 16, trees: true, pines: 0.5, block: { min: 45, span: 25 }, top: 60, layout: "grid", roofs: "mixed", variety: true, exact: true },
  road: { ...ISLAND.road, bank: { run: 3.75, reach: 64 } },
  water: { rivers: { count: 3, head: 120, width: [3, 11], depth: [1.2, 2.6] }, lakes: { count: 4, depth: 2, min: 4, max: 400 } },
};

const RANGE: RangeLayer = { kind: "range", seed: 23, height: 235, width: 480, meander: 120, saw: 0.5, saddle: { at: [-600, 600], depth: 0.88, floor: 100, width: 360 } };

/**
 * A saw-tooth range through the middle with a pass where the circuit crosses it on either side, valleys under a ring of
 * peaks, pines thick in the valleys and thinning up to a tree line, scree and snow above it, a few mountain villages.
 */
export const ALPINE: Recipe = {
  terrain: [
    VALLEY_FLOOR,
    { kind: "fbm", scale: 520, seed: 7, octaves: 5, power: 1.75, amp: 40 },
    // Negative ridges fold the low ground into V-valleys.
    { kind: "ridged", scale: 420, stretch: 1, seed: 11, octaves: 4, power: 3, amp: -26 },
    RANGE,
    // Past the mask the land climbs to a ring of peaks instead of falling to a sea floor.
    { kind: "mask", radius: 960, edge: 170, scale: 300, seed: 3, wobble: 0.3 },
  ],
  biomes: {
    surfaces: HARDPACK,
    zones: { coast: { top: -1, wobble: 0, scale: 90 }, bands: ["forest", "meadow", "upland"] },
    limits: { beach: -1, scree: { up: 0.72, height: 150 }, rock: { up: 0.6, height: 175 }, snow_line: 215, tree_floor: 3, tree_line: 155, pan: null, loose: SurfaceId.SCREE },
    rules: {
      coast: BARE,
      forest: { start: 0.38, fill: 1.2, pine: 1, scrub: 0, extra: 1 },
      meadow: { start: 0.5, fill: 0.35, pine: 0.9, scrub: 0.1, extra: 0 },
      upland: { start: 0.6, fill: 0.12, pine: 0.6, scrub: 0.4, extra: 0 },
    },
    items: { coast: null, meadow: "hay", forest: "log", upland: "rock" },
    ground: {
      coast: { cut: 0.55, above: Ground.GRASS, below: Ground.GRASS, soft: 0 },
      forest: { cut: 0.55, above: Ground.GRASS, below: Ground.FOREST, soft: 0.2 },
      meadow: { cut: 0.6, above: Ground.DRY, below: Ground.GRASS, soft: 0.2 },
      upland: { cut: 0.5, above: Ground.UPLAND, below: Ground.DRY, soft: 0.2 },
    },
  },
  road: { loop: { radius: 600, swing: 260, min: 500, max: 700 }, straights: null, stacks: [4, 2], tongue: true, canyon: null, kickers: { road: 2, total: 8, big: 2 }, runup: { grade: 0.08, reach: 100 }, bank: { run: 3.75, reach: 64 } },
  towns: { min: 2, max: 3, trees: true, pines: 0.5, block: { min: 35, span: 15 }, top: 110, layout: "strip", roofs: "steep", variety: false, exact: true },
  landmarks: [Landmark.MAST],
  scatter: [{ kind: PropKind.BOULDER, spacing: 60, odds: 0.08, biomes: ["meadow", "upland"], road_within: Infinity }],
};

const SNOWFIELD: GroundRule = { cut: 0.55, above: Ground.SNOW, below: Ground.SNOW, soft: 0 };

/**
 * Wide white flats over low rolling ground and stretched drumlins, frozen lakes in the hollows, pine bands in the sheltered
 * low ground, a long gentle loop and a few cabins inside a ring of low hills. Always under the snow kit.
 */
export const TUNDRA: Recipe = {
  terrain: [
    LIFT,
    { kind: "fbm", scale: 640, seed: 7, octaves: 4, power: 1.75, amp: 16 },
    { kind: "ridged", scale: 360, stretch: 3, seed: 11, octaves: 3, power: 2, amp: 5 },
    // Past the mask the land rises to low hills instead of falling to a sea floor.
    { kind: "mask", radius: 960, edge: 26, scale: 380, seed: 3, wobble: 0.3 },
  ],
  biomes: {
    surfaces: HARDPACK,
    zones: { coast: { top: -1, wobble: 0, scale: 90 }, bands: ["forest", "meadow", "upland"] },
    limits: { ...LIMITS, beach: -1 },
    rules: {
      coast: BARE,
      forest: { start: 0.42, fill: 1.1, pine: 1, scrub: 0, extra: 1 },
      meadow: { start: 0.6, fill: 0.12, pine: 1, scrub: 0, extra: 0 },
      upland: BARE,
    },
    items: { coast: null, meadow: "rock", forest: "log", upland: "rock" },
    ground: { coast: SNOWFIELD, forest: SNOWFIELD, meadow: SNOWFIELD, upland: SNOWFIELD },
  },
  road: { loop: { radius: 640, swing: 420, min: 460, max: 820 }, straights: null, stacks: [], tongue: false, canyon: null, kickers: { road: 3, total: 10, big: 2 }, runup: null, bank: null },
  towns: { min: 1, max: 2, trees: true, pines: 1, block: { min: 35, span: 10 }, top: 60, layout: "grid", roofs: "steep", variety: false, exact: true },
  landmarks: [Landmark.MAST],
  scatter: [{ kind: PropKind.BOULDER, spacing: 80, odds: 0.05, biomes: ["meadow", "upland"], road_within: Infinity }],
  snow: SNOW_KIT,
  ice: { count: 5, radius: [60, 140], reach: 760 },
};

const CINDER: GroundRule = { cut: 0.5, above: Ground.UPLAND, below: Ground.DRY, soft: 0.2 };

/**
 * One cone filling the island, a crater in its top, the circuit round the rim and a hairpin road down the flank to the
 * sea: loose scree from the rim down, scrub thickening down the flank. No towns: the flank has no ground flat enough, nor
 * a spur that holds the grade to the rim.
 */
export const VOLCANO: Recipe = {
  terrain: [
    LIFT,
    hills(30),
    ridges(10),
    { kind: "peak", height: 260, radius: 900, reach: 0 },
    { kind: "crater", radius: 200, floor: 0.5, depth: 70, lip: 8, lip_width: 30, lava: 1 },
    shore(960, -9),
  ],
  biomes: {
    surfaces: HARDPACK,
    zones: ZONES,
    limits: { ...LIMITS, scree: { up: 0.8, height: 150 }, rock: { up: 0.7, height: 170 }, snow_line: 1000, tree_line: 110, loose: SurfaceId.SCREE },
    rules: {
      coast: { start: 0.5, fill: 0.12, pine: 0.2, scrub: 0.6, extra: 0 },
      meadow: { start: 0.6, fill: 0.15, pine: 0.3, scrub: 0.6, extra: 0 },
      forest: { start: 0.45, fill: 0.6, pine: 0.9, scrub: 0.2, extra: 0 },
      upland: BARE,
    },
    items: { coast: "rock", meadow: "rock", forest: "log", upland: "rock" },
    ground: { coast: { cut: 0.55, above: Ground.SAND, below: Ground.DUNE, soft: 0 }, meadow: CINDER, forest: { cut: 0.6, above: Ground.DRY, below: Ground.FOREST, soft: 0.2 }, upland: CINDER },
  },
  road: { loop: { radius: 205, swing: 30, min: 195, max: 235 }, straights: null, stacks: [], tongue: false, canyon: null, kickers: { road: 2, total: 6, big: 1 }, runup: { grade: 0.08, reach: 100 }, bank: { run: 3.75, reach: 64 }, descent: { stacks: [12, 13, 14], outlet: 2, tries: 16, excludes: ["bus"] }, lap_par: 1.2, trail_races: false },
  towns: { min: 0, max: 0, trees: false, pines: 1, block: { min: 35, span: 10 }, top: 60, layout: "grid", roofs: "flat", variety: false, exact: true },
  landmarks: [],
  scatter: [{ kind: PropKind.BOULDER, spacing: 50, odds: 0.1, biomes: ["meadow", "upland"], road_within: Infinity }],
};

/**
 * 120 m dunes 850 m apart: a 200 m flat corridor, a 15 degree windward rise and a planar slip face at 0.54, which the
 * crests' bend and the gaps' sides steepen to 33 degrees at most.
 */
const BIG_DUNE: DuneBand = { wave: 850, height: 120, lee: 0.25, bend: 0.2, fields: false, face: { grade: 0.54, brink: 60, toe: 40, floor: 200 } };
/** The dune sea's bands ride the big dunes this much lower, so stacked on a windward rise they stay under repose. */
const RIPPLE = 0.6;

/**
 * The dune sea under one band of big dunes, for dune bashing. The circuit runs two corridors and parts the dune between
 * them at each end. Height paints no scree, rock or snow. No kickers: crest jumps want rules of their own.
 */
const SEA = DESERT.terrain.find((l): l is DunesLayer => l.kind === "dunes");

export const BIG_DUNES: Recipe = {
  ...DESERT,
  terrain: DESERT.terrain.map((l) =>
    l.kind === "dunes" ? { ...l, bands: [...l.bands.map((b) => ({ ...b, height: b.height * RIPPLE })), BIG_DUNE], gaps: { above: 20, width: 40, ease: 600, at: [] } } : l,
  ),
  biomes: { ...DESERT.biomes, limits: { ...DESERT.biomes.limits, scree: { up: 0.8, height: 10_000 }, rock: { up: 0.7, height: 10_000 }, snow_line: 10_000 } },
  road: { ...DESERT.road, straights: null, canyon: null, kickers: { road: 0, total: 0, big: 0 }, corridor: { half: 280, wind: SEA?.seed ?? 0 }, street_races: false, lap_excludes: ["bus"] },
  towns: { ...DESERT.towns, min: 0, top: 10_000, pan: true },
};

/**
 * The tundra's snowfields round one tall peak: the circuit on packed snow round its top, and a one-way descent off it
 * down a frozen riverbed to the low ground.
 */
export const ICE_CANYON: Recipe = {
  ...TUNDRA,
  terrain: [LIFT, ...TUNDRA.terrain.slice(1, 3), { kind: "peak", height: 100, radius: 1000, reach: 0 }, ...TUNDRA.terrain.slice(3)],
  road: { loop: { radius: 230, swing: 30, min: 215, max: 260 }, straights: null, stacks: [], tongue: false, canyon: null, kickers: { road: 2, total: 6, big: 1 }, runup: { grade: 0.08, reach: 100 }, bank: { run: 3.75, reach: 64 }, descent: { stacks: [0, 2, 4], outlet: 20, tries: 16, bed: { surface: SurfaceId.ICE, half: 12, bank: { run: 1, reach: 24 }, radius: 30, stride: 3, falls: { count: 4, drop: 4 }, pads: SurfaceId.PACKED_SNOW }, excludes: ["bus", "formula"], par: 1.35 }, lap_par: 1.2, trail_races: false },
  towns: { ...TUNDRA.towns, min: 0, max: 0 },
};
