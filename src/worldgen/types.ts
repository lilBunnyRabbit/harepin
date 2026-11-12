import type { GroundPlan } from "./stamp";

export const SIZE = 2048;
export const CELL = 4;
export const N = SIZE / CELL;
export const ORIGIN = -SIZE / 2;
export const ROAD_HALF = 6;
export const STREET_HALF = 4;
/** Sidewalk strip beyond each street edge; part of the street surface for lot setbacks, not for grip. */
export const SIDEWALK = 2;
export const SPUR_HALF = 5;
export const LOCAL_HALF = 5;
export const SHOULDER = 16;
/** Steepest a spur may climb, rise over run. */
export const SPUR_GRADE = 0.12;
/** Road index of the race start grid, counted back from the start line. */
export const SPAWN_INDEX = -40;
/**
 * Ground surfaces, each with a LUT row of its own and one half-way to rock. DIRT is firm: trails, and hardpack a recipe lays.
 * SNOW to SLUSH are the snow kit's rows; ASH and after the volcano's.
 */
export const Ground = { GRASS: 0, DRY: 1, SAND: 2, FOREST: 3, UPLAND: 4, DUNE: 5, DIRT: 6, PAN: 7, SNOW: 8, PACKED_SNOW: 9, ICE: 10, SLUSH: 11, ASH: 12, SCREE: 13, CINDER: 14, EMBER: 15 } as const;
export type Ground = (typeof Ground)[keyof typeof Ground];
/**
 * What the wheels drive on, per vertex of the `surface` grid; each id has a grip row in its kind's `GripTable`. GRASS is the
 * kind's own ground (loose sand on the desert), every other id a surface laid over it. Stored in the grid: never renumber.
 */
export const SurfaceId = { GRASS: 0, DIRT: 1, HARDPACK: 2, SCREE: 3, WET: 4, SNOW: 5, PACKED_SNOW: 6, ICE: 7, SLUSH: 8, LAVA: 9 } as const;
export type SurfaceId = (typeof SurfaceId)[keyof typeof SurfaceId];
/** The ground row each laid surface paints, indexed by `SurfaceId`, so colour matches what the wheels feel; null keeps the biome's colour. */
export const SURFACE_GROUND = [null, Ground.DIRT, Ground.PAN, null, Ground.DIRT, Ground.SNOW, Ground.PACKED_SNOW, Ground.ICE, Ground.SLUSH, Ground.DIRT] as const satisfies Record<SurfaceId, Ground | null>;
/** Bump whenever `generate` makes a different island for the same seed: peers and saved records are matched on it. */
export const WORLD_VERSION = 11;

/** Bump whenever `generate_sky` makes a different track for the same seed. */
export const SKY_VERSION = 3;

/** Bump whenever `generate_sky` makes a different rooftop track for the same seed. */
export const ROOFTOPS_VERSION = 1;

export const WorldKind = { ISLAND: "island", SKY: "sky", DESERT: "desert", MAINLAND: "mainland", ALPINE: "alpine", TUNDRA: "tundra", ROOFTOPS: "rooftops", VOLCANO: "volcano", BIG_DUNES: "dunes", ICE_CANYON: "icecanyon" } as const;
export type WorldKind = (typeof WorldKind)[keyof typeof WorldKind];
/** What a URL or save without a world, or with one this build doesn't know, drives. */
export const DEFAULT_KIND: WorldKind = WorldKind.ISLAND;

export function is_kind(value: unknown): value is WorldKind {
  return typeof value === "string" && Object.values<string>(WorldKind).includes(value);
}

export function parse_kind(text: string | null | undefined): WorldKind {
  return is_kind(text) ? text : DEFAULT_KIND;
}

export interface RoadPoint {
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
}

export interface Tree {
  x: number;
  y: number;
  z: number;
  scale: number;
  kind: number;
}

export interface Checkpoint {
  x: number;
  y: number;
  z: number;
  heading: number;
  index: number;
}

/** `heights` and `road_dist` are (n + 1)² vertex grids, row-major from (-size / 2, -size / 2). */
export interface Terrain {
  seed: number;
  size: number;
  cell: number;
  n: number;
  heights: Float32Array<ArrayBuffer>;
  /** Distance to the nearest road surface edge plus ROAD_HALF, so every road reads as ROAD_HALF wide to grip(). */
  road_dist: Float32Array<ArrayBuffer>;
  /** `SurfaceId` under the wheels per vertex: GRASS, DIRT on a trail, HARDPACK on a pan, or SCREE on high rocky ground. Asphalt is read from `road_dist`. */
  surface: Uint8Array<ArrayBuffer>;
}

export type NodeKind = "junction" | "end" | "town";
/** `highway`: a town's spur to the circuit; `local`: a road between towns. */
export type EdgeKind = "highway" | "local" | "street";

export interface RoadNode {
  id: number;
  x: number;
  z: number;
  y: number;
  kind: NodeKind;
}

export interface RoadEdge {
  id: number;
  a: number;
  b: number;
  kind: EdgeKind;
  half: number;
  closed: boolean;
  points: RoadPoint[];
}

export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadEdge[];
}

export interface Town {
  id: number;
  x: number;
  z: number;
  radius: number;
  /** Street grid axis as a unit vector; `angle` = atan2(ux, uz) for display only. */
  ux: number;
  uz: number;
  angle: number;
  name: string;
  /** Town ground is the plane y + gx * (x - town.x) + gz * (z - town.z) out to `core`, easing back to terrain beyond. */
  y: number;
  gx: number;
  gz: number;
  /** Radius every lot corner stays inside. */
  core: number;
  /** A strip village's ground and lots also stay within this many metres of its main street, across it. */
  band?: number;
  /** Street spacing of the grid, centre to centre. */
  block: number;
}

export type LotKind = "house" | "shop" | "parking" | "garden" | "empty";

/** Lot-local frame: +z faces the street (`fx`, `fz` in world), +x runs along it. */
export interface Lot {
  id: number;
  town: number;
  edge: number;
  side: -1 | 1;
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  fx: number;
  fz: number;
  angle: number;
  kind: LotKind;
}

export interface Building {
  lot: number;
  x: number;
  y: number;
  z: number;
  hw: number;
  hd: number;
  fx: number;
  fz: number;
  angle: number;
  height: number;
  style: number;
  roof: Roof;
}

/** GABLE ridge runs along local x, CROSS along local z, HIP slopes on all four sides. */
export const Roof = { FLAT: "flat", GABLE: "gable", CROSS: "cross", HIP: "hip", STEEP: "steep" } as const;
export type Roof = (typeof Roof)[keyof typeof Roof];

export const PropKind = {
  STREET_LIGHT: "street_light",
  MAST: "mast",
  LIGHTHOUSE: "lighthouse",
  TURBINE: "turbine",
  ARCH: "arch",
  CACTUS: "cactus",
  BOULDER: "boulder",
  SPIRE: "spire",
  TANK: "tank",
  WIND_PUMP: "wind_pump",
} as const;
export type PropKind = (typeof PropKind)[keyof typeof PropKind];

export interface Prop {
  x: number;
  y: number;
  z: number;
  angle: number;
  kind: PropKind;
  /** Street lights and towers 1; scattered props their size; the arch spans the road with this half distance between its leg centres, at `y` its road height. */
  scale: number;
}

export type ParkingKind = "open";
export type ObstacleKind = "car" | "wall" | "pillar" | "bollard" | "kerb";

export interface Bay {
  x: number;
  z: number;
  heading: number;
  w: number;
  l: number;
  either: boolean;
  target: boolean;
}

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  z: number;
  heading: number;
  w: number;
  l: number;
  h: number;
}

/** Shape from docs/brainstorm/minigames.md §1; everything inside is lot-local, headings in radians. */
export interface ParkingLot {
  id: string;
  lot: number;
  kind: ParkingKind;
  seed: number;
  difficulty: number;
  par: number;
  origin: { x: number; z: number; y: number };
  heading: number;
  size: { w: number; d: number };
  /** Street the access meets: edge id, point index on that edge, side of the street the lot sits on. */
  entry: { edge: number; index: number; side: -1 | 1; width: number };
  start: { x: number; z: number; heading: number };
  bays: Bay[];
  obstacles: Obstacle[];
}

export const PieceKind = { STRAIGHT: "straight", ARC: "arc", KICKER: "kicker", GAP: "gap", LANDING: "landing", PAD: "pad" } as const;
export type PieceKind = (typeof PieceKind)[keyof typeof PieceKind];

/** One run of deck between two joints; `s0` is its start along the centreline, in metres. */
export interface DeckPiece {
  kind: PieceKind;
  s0: number;
  length: number;
  /** Signed curvature 1/R of the arc's middle, + = left; 0 on straights. */
  curve: number;
}

/** Depth of the deck slab under its surface, metres. */
export const DECK_THICK = 0.4;

/** Floats per centreline sample in `Deck.line`: x, y, z, tx, tz, bank (rad, + = left side up), half-width, solid (0 over a gap), s. */
export const DECK_STRIDE = 9;

/** A floating track: the deck surface is the centreline `line` swept across `half` with its bank. */
export interface Deck {
  half: number;
  pieces: DeckPiece[];
  line: Float64Array<ArrayBuffer>;
  pads: { s0: number; s1: number }[];
  /** Stretches with no rail on `side` (+1 left, -1 right, 0 both), metres along the lap. */
  open: OpenSection[];
}

export interface OpenSection {
  s0: number;
  s1: number;
  side: -1 | 0 | 1;
}

export interface WorldData {
  kind: WorldKind;
  /** The sky track's surface; null on the island. */
  deck: Deck | null;
  terrain: Terrain;
  /** The ground grids as a base plus ordered writes, so a worker can rebuild any tile of `terrain` alone. */
  ground: GroundPlan;
  graph: RoadGraph;
  towns: Town[];
  lots: Lot[];
  buildings: Building[];
  props: Prop[];
  parking: ParkingLot[];
  trees: Tree[];
  solids: Solid[];
  ramps: Ramp[];
  items: Item[];
  challenges: Challenge[];
  checkpoints: Checkpoint[];
  /** Edge ids of the race loop, in driving order. */
  circuit: number[];
  road: RoadPoint[];
  routes: Route[];
  canyon: Canyon | null;
  timings: [string, number][];
}

export interface Canyon {
  /** Centreline from the summit flank down to the coast, 4 m apart. */
  points: [number, number][];
  depth: number;
  /** Half-width of the flat floor, and the run of each wall beyond it. */
  floor: number;
  wall: number;
}

export const RouteKind = { CIRCUIT: "circuit", STREET: "street", OFFROAD: "offroad", SPRINT: "sprint" } as const;
export type RouteKind = (typeof RouteKind)[keyof typeof RouteKind];

/** A closed route's lap ends back on `points[0]`. */
export interface Route {
  id: string;
  kind: RouteKind;
  closed: boolean;
  points: RoadPoint[];
  /** Gates in driving order; the last one is the finish line. */
  checkpoints: Checkpoint[];
  gate_hw: number;
  /** Metres, one lap for a closed route. */
  length: number;
  par_ms: number;
  /** Cones across the roads the route passes, placed only while it is raced. */
  closure: Extract<Solid, { kind: "circle" }>[];
  /** Car ids it is not raced in: too slow or too big for it, so the race menu blocks it for them. */
  excludes?: readonly string[];
}

/**
 * Box frame: local +z points along (sin, cos) in world x/z, local +x along (cos, -sin); hw spans x, hd spans z.
 * A box with `bottom` spans y + bottom to y + height and is tested against the car's whole body, so a car can fly under
 * it; one without stands on the ground and stops a car whose centre is below its top.
 */
export type Solid =
  | { kind: "circle"; x: number; y: number; z: number; radius: number; height: number }
  | { kind: "box"; x: number; y: number; z: number; hw: number; hd: number; cos: number; sin: number; height: number; bottom?: number };

/** LANDING is a planar deck with no lip: `rise` 0, falling at `grade` for `length` metres along (fx, fz). */
export const RampKind = { KICKER: "kicker", BIG: "big", LANDING: "landing" } as const;
export type RampKind = (typeof RampKind)[keyof typeof RampKind];

/**
 * A wedge driven up along (fx, fz): toe centre at (x, z), `rise` above the base line at the lip `length` further on, then
 * a steep drop. The base line runs from `y` at the toe with `grade` rise per metre. `landing` metres past the lip stay
 * clear; `speed` (m/s at the toe) is the run its challenge, if any, is tuned for.
 */
export interface Ramp {
  id: number;
  kind: RampKind;
  x: number;
  y: number;
  z: number;
  fx: number;
  fz: number;
  hw: number;
  length: number;
  rise: number;
  grade: number;
  landing: number;
  speed: number;
  /** Laid across the full width of the circuit, which carries on under its run-up, flight and landing. */
  road?: boolean;
  /** Drop per metre of the face past the lip; the steep kicker back when absent. */
  back?: number;
  /** A sky-track lip built into the deck: listed for map marks, spawn blocks and autolap, never ridden as a wedge. */
  deck?: true;
}

export const ItemKind = { CONE: "cone", BARREL: "barrel", HAY: "hay", LOG: "log", ROCK: "rock", BARRIER: "barrier" } as const;
export type ItemKind = (typeof ItemKind)[keyof typeof ItemKind];

/** Light items get knocked away by the car on the client; heavy ones are solids. Facing is (fx, fz). */
export interface Item {
  kind: ItemKind;
  x: number;
  y: number;
  z: number;
  fx: number;
  fz: number;
  scale: number;
  light: boolean;
}

export const ChallengeKind = { WALL: "wall", HOOP: "hoop", PILLARS: "pillars", BAR: "bar" } as const;
export type ChallengeKind = (typeof ChallengeKind)[keyof typeof ChallengeKind];

/**
 * Something to fly through or over across a ramp's flight line, facing back at the ramp along -(fx, fz). The opening is
 * |lateral| < gap_hw and gap_bottom < height above `y` < gap_top.
 */
export interface Challenge {
  id: number;
  ramp: number;
  kind: ChallengeKind;
  x: number;
  y: number;
  z: number;
  fx: number;
  fz: number;
  gap_hw: number;
  gap_bottom: number;
  gap_top: number;
}
