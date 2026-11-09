export const SIZE = 2048;
export const CELL = 4;
export const N = SIZE / CELL;
export const ORIGIN = -SIZE / 2;
export const ROAD_HALF = 6;
export const STREET_HALF = 4;
/** Sidewalk strip beyond each street edge; part of the street surface for lot setbacks, not for grip. */
export const SIDEWALK = 2;
export const SPUR_HALF = 5;
export const SHOULDER = 16;
/** Steepest a spur may climb, rise over run. */
export const SPUR_GRADE = 0.12;
/** Road index of the race start grid, counted back from the start line. */
export const SPAWN_INDEX = -40;
/** Bump whenever `generate` makes a different island for the same seed: peers and saved records are matched on it. */
export const WORLD_VERSION = 2;

/** Bump whenever `generate_sky` makes a different track for the same seed. */
export const SKY_VERSION = 3;

export const WorldKind = { ISLAND: "island", SKY: "sky" } as const;
export type WorldKind = (typeof WorldKind)[keyof typeof WorldKind];

/** Map identity peers compare: the island keeps WORLD_VERSION, so old builds see a sky peer as on a foreign map. */
export function world_id(kind: WorldKind): number {
  return kind === WorldKind.SKY ? 1000 + SKY_VERSION : WORLD_VERSION;
}

export function parse_kind(text: string | null | undefined): WorldKind {
  return text === WorldKind.SKY ? WorldKind.SKY : WorldKind.ISLAND;
}

/** Storage key part for records set on `seed`'s world, so a new world starts with a clean sheet. */
export function world_key(seed: number, kind: WorldKind = WorldKind.ISLAND): string {
  return kind === WorldKind.SKY ? `${seed}:sky${SKY_VERSION}` : `${seed}:w${WORLD_VERSION}`;
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
}

export type NodeKind = "junction" | "end" | "town";
export type EdgeKind = "highway" | "street";

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
export const Roof = { FLAT: "flat", GABLE: "gable", CROSS: "cross", HIP: "hip" } as const;
export type Roof = (typeof Roof)[keyof typeof Roof];

export const PropKind = { STREET_LIGHT: "street_light" } as const;
export type PropKind = (typeof PropKind)[keyof typeof PropKind];

export interface Prop {
  x: number;
  y: number;
  z: number;
  angle: number;
  kind: PropKind;
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
  timings: [string, number][];
}

export const RouteKind = { CIRCUIT: "circuit", STREET: "street", OFFROAD: "offroad" } as const;
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
