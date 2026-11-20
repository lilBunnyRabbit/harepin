import { DECALS, DECAL_NAMES, DEFAULT_PARTS, FINISHES, FINISH_NAMES, MAX_NUMBER, MAX_PAINT, NEONS, NEON_NAMES, NEON_TONES, NEON_TONE_NAMES, SLOTS, SLOT_NAMES, WHOLE_CAR, part_of, slot_view, type Build, type FinishName, type Neon, type Slot, type SlotView } from "../car/build";
import { TIERS } from "../career/career";
import { DECAL_PRICE, FINISH_PRICE, NEON_PRICE, decal_id, finish_id, neon_id, type Cosmetic } from "../career/prices";
import { REWARD_DECALS, reward_paint_name, type Unlocks } from "../career/rewards";
import type { PartPick } from "../career/wallet";
import { NEUTRAL_INKS, car_paints, decal_inks } from "../theme/palette";

const SIDE_VIEW: SlotView = { yaw: -0.87 };

type Kind = "part" | "paint" | "finish" | "ink" | "decal" | "number" | "neon" | "glow";

/** The two rows of slot chips: what the car drives with, and what it wears. */
export type ItemGroup = "parts" | "look";

export interface Item {
  id: string;
  label: string;
  kind: Kind;
  group: ItemGroup;
  view: SlotView;
  count: number;
  /** Build values behind the options, when they are not simply 0 to `count - 1`. */
  values?: readonly number[];
  /** The fitted option in `build`. */
  at(build: Build): number;
  with(build: Build, option: number): Build;
  name(option: number): string;
  blurb(option: number): string;
  /** The option's shop id, when it is sold rather than free. */
  cosmetic?(option: number): Cosmetic | null;
  slot?: Slot;
}

const part_item = (slot: Slot): Item => ({
  id: slot,
  slot,
  label: SLOTS[slot].label,
  kind: "part",
  group: "parts",
  view: slot_view(slot),
  count: SLOTS[slot].parts.length,
  at: (b) => b.parts[slot],
  with: (b, i) => ({ ...b, parts: { ...b.parts, [slot]: i } }),
  name: (i) => part_of(slot, i).name,
  blurb: (i) => part_of(slot, i).blurb ?? "",
});

const PART_ITEMS = SLOT_NAMES.map(part_item);

// Rewards not earned yet stay off the strip; one a loaded build code already wears stays on it.
function listed<T>(base: readonly T[], earned: readonly T[], fitted: T): T[] {
  const values = [...base, ...earned];
  return values.includes(fitted) ? values : [...values, fitted];
}

const PLAIN_DECALS = DECALS.map((_, i) => i).filter((i) => !REWARD_DECALS.includes(i));

function decal_item(build: Build, unlocks: Unlocks): Item {
  const values = listed(PLAIN_DECALS, unlocks.decals, build.decal);
  return {
    id: "decal",
    label: "Decal",
    kind: "decal",
    group: "look",
    view: SIDE_VIEW,
    count: values.length,
    values,
    at: (b) => values.indexOf(b.decal),
    with: (b, i) => ({ ...b, decal: values[i] }),
    name: (i) => DECAL_NAMES[DECALS[values[i]]],
    blurb: () => "",
    cosmetic: (i) => (DECAL_PRICE[DECALS[values[i]]] ? decal_id(DECALS[values[i]]) : null),
  };
}

const NUMBER_ITEM: Item = {
  id: "number",
  label: "Number",
  kind: "number",
  group: "look",
  view: SIDE_VIEW,
  count: MAX_NUMBER + 1,
  at: (b) => b.number,
  with: (b, i) => ({ ...b, number: i }),
  name: (i) => String(i).padStart(2, "0"),
  blurb: () => "",
};

const PLAIN_PAINTS = car_paints.map((_, i) => i);
const paint_value = (paint: number) => (paint > MAX_PAINT ? paint : paint % car_paints.length);

function paint_item(build: Build, unlocks: Unlocks): Item {
  const values = listed(PLAIN_PAINTS, unlocks.paints, paint_value(build.paint));
  return {
    id: "paint",
    label: "Paint",
    kind: "paint",
    group: "look",
    view: WHOLE_CAR,
    count: values.length,
    values,
    at: (b) => values.indexOf(paint_value(b.paint)),
    with: (b, i) => ({ ...b, paint: values[i] }),
    name: (i) => {
      const tier = TIERS.find((t) => t.rewards.paint === values[i]);
      return tier ? reward_paint_name(tier) : `Paint ${values[i] + 1}`;
    },
    blurb: () => "",
  };
}

const INK_ITEM: Item = {
  id: "ink",
  label: "Decal colour",
  kind: "ink",
  group: "look",
  view: SIDE_VIEW,
  count: decal_inks.length,
  at: (b) => b.ink % decal_inks.length,
  with: (b, i) => ({ ...b, ink: i }),
  name: (i) => (i < NEUTRAL_INKS ? ["Light", "Dark"][i] : `Paint ${i - NEUTRAL_INKS + 1}`),
  blurb: () => "",
};

/** Three-quarter rear: the light lies on the ground behind and beside the car. */
const GLOW_VIEW: SlotView = { yaw: 2.6 };
const NEON_BLURBS: Record<Neon, string> = { none: "", pool: "Soft light under the whole car", ring: "A bright line round the car that runs with the road" };

const NEON_ITEM: Item = {
  id: "neon",
  label: "Neon",
  kind: "neon",
  group: "look",
  view: GLOW_VIEW,
  count: NEONS.length,
  at: (b) => b.neon,
  with: (b, i) => ({ ...b, neon: i }),
  name: (i) => NEON_NAMES[NEONS[i]],
  blurb: (i) => NEON_BLURBS[NEONS[i]],
  cosmetic: (i) => (NEON_PRICE[NEONS[i]] ? neon_id(NEONS[i]) : null),
};

const FINISH_BLURBS: Record<FinishName, string> = {
  standard: "Flat colour, as it comes",
  satin: "A soft sheen that catches the sky",
  metallic: "Flake that lights the paint's own colour",
  pearl: "A deep gloss with a bright edge",
};

const FINISH_ITEM: Item = {
  id: "finish",
  label: "Finish",
  kind: "finish",
  group: "look",
  view: WHOLE_CAR,
  count: FINISHES.length,
  at: (b) => b.finish,
  with: (b, i) => ({ ...b, finish: i }),
  name: (i) => FINISH_NAMES[FINISHES[i]],
  blurb: (i) => FINISH_BLURBS[FINISHES[i]],
  cosmetic: (i) => (FINISH_PRICE[FINISHES[i]] ? finish_id(FINISHES[i]) : null),
};

const GLOW_ITEM: Item = {
  id: "glow",
  label: "Neon colour",
  kind: "glow",
  group: "look",
  view: GLOW_VIEW,
  count: NEON_TONES.length,
  at: (b) => b.neon_tone,
  with: (b, i) => ({ ...b, neon_tone: i }),
  name: (i) => NEON_TONE_NAMES[NEON_TONES[i]],
  blurb: () => "",
};

/** A build for the player's own car less the sold decal, neon and finish they haven't bought, with the names of what came off. */
export function strip_unowned(build: Build, has: (id: Cosmetic) => boolean): { build: Build; dropped: string[] } {
  const decal = DECALS[build.decal];
  const neon = NEONS[build.neon];
  const finish = FINISHES[build.finish];
  const off_decal = DECAL_PRICE[decal] !== undefined && !has(decal_id(decal));
  const off_neon = NEON_PRICE[neon] !== undefined && !has(neon_id(neon));
  const off_finish = FINISH_PRICE[finish] !== undefined && !has(finish_id(finish));
  const dropped = [...(off_decal ? [DECAL_NAMES[decal]] : []), ...(off_neon ? [`${NEON_NAMES[neon]} neon`] : []), ...(off_finish ? [`${FINISH_NAMES[finish]} finish`] : [])];
  if (!dropped.length) return { build, dropped };
  return { build: { ...build, ...(off_decal ? { decal: 0 } : {}), ...(off_neon ? { neon: 0, neon_tone: 0 } : {}), ...(off_finish ? { finish: 0 } : {}) }, dropped };
}

// "GT kit" on the aero kit reads "GT kit", not "GT kit aero kit".
export function part_label(name: string, slot_label: string): string {
  const part = slot_label.toLowerCase();
  return name.toLowerCase().endsWith(part.split(" ").at(-1) ?? part) ? name : `${name} ${part}`;
}

export const pick_label = ({ slot, index }: PartPick) => part_label(part_of(slot, index).name, SLOTS[slot].label);

/** Slots whose parts are kinds, not levels: Rally tyres are no step down from Slicks. */
const KIND_SLOTS: ReadonlySet<Slot> = new Set(["tyres", "suspension"]);

/**
 * A build for the player's own car on only the parts bought for it, and the parts it wanted as `missing`. A part not owned
 * drops to the nearest owned one below it in a levelled slot (part 0 is free in every slot), to stock in a slot of kinds.
 */
export function own_parts(build: Build, owns: (pick: PartPick) => boolean): { build: Build; missing: PartPick[] } {
  const missing = SLOT_NAMES.map((slot) => ({ slot, index: build.parts[slot] })).filter((pick) => !owns(pick));
  if (!missing.length) return { build, missing };
  const parts = { ...build.parts };
  for (const { slot, index } of missing) {
    if (KIND_SLOTS.has(slot)) {
      parts[slot] = DEFAULT_PARTS[slot];
      continue;
    }
    let at = index - 1;
    while (at > 0 && !owns({ slot, index: at })) at--;
    parts[slot] = Math.max(0, at);
  }
  return { build: { ...build, parts }, missing };
}

/**
 * Every slot of the garage, parts first: the reward paints and decals earned, the finish only over a plain paint (a reward
 * paint wears its own), and the number, decal colour and neon colour only while a decal or a neon shows them.
 */
export function garage_items(build: Build, unlocks: Unlocks): Item[] {
  const decal = DECALS[build.decal];
  return [...PART_ITEMS, paint_item(build, unlocks), ...(build.paint > MAX_PAINT ? [] : [FINISH_ITEM]), decal_item(build, unlocks), ...(decal === "number" ? [NUMBER_ITEM] : []), ...(decal === "none" ? [] : [INK_ITEM]), NEON_ITEM, ...(NEONS[build.neon] === "none" ? [] : [GLOW_ITEM])];
}

const SLOT_ICONS = new Set(["engine", "tyres", "aero", "suspension", "brakes", "weight", "bias", "nitro", "decal", "number", "ink", "neon", "glow"]);

/** The sprite icon for a slot or option kind. */
export const slot_icon = (id: string) => (id === "paint" || id === "finish" ? "icon-paint" : `icon-slot-${SLOT_ICONS.has(id) ? id : "part"}`);
