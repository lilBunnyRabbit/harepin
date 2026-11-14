import { is_kind, type WorldKind } from "../worldgen/types";

export const AssetKind = {
  CAR: "car",
  WHEEL: "wheel",
  WING: "wing",
  AERO: "aero",
  ARCHES: "arches",
  MIRROR: "mirror",
  BUILDING: "building",
  GROUND: "ground",
  RAMP: "ramp",
  TREE: "tree",
  PROP: "prop",
  PIECE: "piece",
} as const;
export type AssetKind = (typeof AssetKind)[keyof typeof AssetKind];

export const AssetGroup = { CAR: "car", PART: "part", WORLD: "world" } as const;
export type AssetGroup = (typeof AssetGroup)[keyof typeof AssetGroup];

export interface AssetDef {
  label: string;
  group: AssetGroup;
  seeded: boolean;
}

export const ASSETS: Record<AssetKind, AssetDef> = {
  car: { label: "Car", group: AssetGroup.CAR, seeded: false },
  wheel: { label: "Wheels", group: AssetGroup.PART, seeded: false },
  wing: { label: "Rear wing", group: AssetGroup.PART, seeded: false },
  aero: { label: "Aero kit", group: AssetGroup.PART, seeded: false },
  arches: { label: "Arches", group: AssetGroup.PART, seeded: false },
  mirror: { label: "Mirrors", group: AssetGroup.PART, seeded: false },
  building: { label: "Building", group: AssetGroup.WORLD, seeded: true },
  ground: { label: "Square or yard", group: AssetGroup.WORLD, seeded: true },
  ramp: { label: "Jump ramp", group: AssetGroup.WORLD, seeded: true },
  tree: { label: "Tree", group: AssetGroup.WORLD, seeded: false },
  prop: { label: "Prop or landmark", group: AssetGroup.WORLD, seeded: false },
  piece: { label: "Kit piece", group: AssetGroup.WORLD, seeded: false },
};

export const ASSET_KINDS = Object.keys(ASSETS) as AssetKind[];
export type PartKind = "wheel" | "wing" | "aero" | "arches" | "mirror";
export type WorldAssetKind = "building" | "ground" | "ramp" | "tree" | "prop" | "piece";

export interface PartAsset {
  kind: PartKind;
  on: boolean;
}

export interface WorldAsset {
  kind: WorldAssetKind;
  world: WorldKind;
  /** Which one within the kind: an index into the generated world (`b12`) or a name (`pine`). */
  item: string;
  /** World seed; 0 for an asset that is the same on every seed. */
  seed: number;
}

export type Asset = PartAsset | WorldAsset;

/** What a note is filed under and an export header names: kind, id (car or world), variant (preset or item), seed. */
export interface AssetRef {
  kind: AssetKind;
  id: string;
  variant: string;
  seed: number;
}

const ITEM = /^[a-z0-9_-]{1,40}$/;
export const MAX_SEED = 2 ** 31 - 1;

export const is_asset_kind = (v: unknown): v is AssetKind => typeof v === "string" && v in ASSETS;
export const is_part = (kind: AssetKind): kind is PartKind => ASSETS[kind].group === AssetGroup.PART;
export const is_world_asset = (kind: AssetKind): kind is WorldAssetKind => ASSETS[kind].group === AssetGroup.WORLD;
export const is_item = (v: unknown): v is string => typeof v === "string" && ITEM.test(v);
export const is_seed = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_SEED;

export function checked_asset(x: unknown): Asset | null {
  if (typeof x !== "object" || x === null) return null;
  const a = x as Record<string, unknown>;
  if (!is_asset_kind(a.kind) || a.kind === AssetKind.CAR) return null;
  if (is_part(a.kind)) return typeof a.on === "boolean" ? { kind: a.kind, on: a.on } : null;
  if (!is_world_asset(a.kind) || !is_kind(a.world) || !is_item(a.item) || !is_seed(a.seed)) return null;
  return { kind: a.kind, world: a.world, item: a.item, seed: ASSETS[a.kind].seeded ? a.seed : 0 };
}

export function asset_of_ref(ref: AssetRef, on: boolean): Asset | null | undefined {
  if (ref.kind === AssetKind.CAR) return null;
  if (is_part(ref.kind)) return { kind: ref.kind, on };
  return checked_asset({ kind: ref.kind, world: ref.id, item: ref.variant, seed: ref.seed }) ?? undefined;
}

export function asset_key(ref: AssetRef): string {
  // The car keeps the `car/preset` key notes were saved under before there were other assets.
  return ref.kind === AssetKind.CAR ? `${ref.id}/${ref.variant}` : `${ref.kind}:${ref.id}/${ref.variant}@${ref.seed}`;
}
