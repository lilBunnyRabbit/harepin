import { DECALS, DECAL_NAMES, MAX_NUMBER, MAX_PAINT, SLOTS, SLOT_NAMES, WHOLE_CAR, part_of, slot_view, type Build, type Decal, type Slot, type SlotView } from "../car/build";
import { CARS, is_car } from "../car/cars";
import { TIERS } from "../career/career";
import { REWARD_DECALS, reward_paint_name, type Unlocks } from "../career/rewards";
import { NEUTRAL_INKS, car_paints, decal_inks } from "../theme/palette";

const SIDE_VIEW: SlotView = { yaw: -0.87 };
/** Slots shown under Body: the parts you see first on the car. Every other slot lands under Performance. */
const BODY_SLOTS: readonly Slot[] = ["aero"];

type Kind = "part" | "car" | "paint" | "ink" | "decal" | "number";

export interface Item {
  id: string;
  label: string;
  kind: Kind;
  view: SlotView;
  count: number;
  /** Build values behind the options, when they are not simply 0 to `count - 1`. */
  values?: readonly number[];
  /** The fitted option in `build`. */
  at(build: Build): number;
  with(build: Build, option: number): Build;
  name(option: number): string;
  blurb(option: number): string;
}

const CAR_IDS = Object.keys(CARS).filter(is_car);

const part_item = (slot: Slot): Item => ({
  id: slot,
  label: SLOTS[slot].label,
  kind: "part",
  view: slot_view(slot),
  count: SLOTS[slot].parts.length,
  at: (b) => b.parts[slot],
  with: (b, i) => ({ ...b, parts: { ...b.parts, [slot]: i } }),
  name: (i) => part_of(slot, i).name,
  blurb: (i) => part_of(slot, i).blurb ?? "",
});

const PART_ITEMS = new Map(SLOT_NAMES.map((slot) => [slot, part_item(slot)]));
const part_items = (slots: readonly Slot[]) => slots.flatMap((slot) => PART_ITEMS.get(slot) ?? []);

const CAR_ITEM: Item = {
  id: "car",
  label: "Car",
  kind: "car",
  view: WHOLE_CAR,
  count: CAR_IDS.length,
  at: (b) => CAR_IDS.indexOf(b.car),
  with: (b, i) => ({ ...b, car: CAR_IDS[i] }),
  name: (i) => CARS[CAR_IDS[i]].name,
  blurb: (i) => {
    const spec = CARS[CAR_IDS[i]];
    return `${spec.drive.toUpperCase()} · ${Math.round(spec.mass)} kg`;
  },
};

// Rewards not earned yet stay off the strip; one a loaded build code already wears stays on it.
function listed(base: readonly number[], earned: readonly number[], fitted: number): number[] {
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
    view: SIDE_VIEW,
    count: values.length,
    values,
    at: (b) => values.indexOf(b.decal),
    with: (b, i) => ({ ...b, decal: values[i] }),
    name: (i) => DECAL_NAMES[DECALS[values[i]]],
    blurb: () => "",
  };
}

const NUMBER_ITEM: Item = {
  id: "number",
  label: "Number",
  kind: "number",
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
  view: SIDE_VIEW,
  count: decal_inks.length,
  at: (b) => b.ink % decal_inks.length,
  with: (b, i) => ({ ...b, ink: i }),
  name: (i) => (i < NEUTRAL_INKS ? ["Light", "Dark"][i] : `Paint ${i - NEUTRAL_INKS + 1}`),
  blurb: () => "",
};

/** Garage tabs other screens open straight into. */
export const GarageSection = {
  BODY: "body",
  PERFORMANCE: "performance",
  PAINT: "paint",
  BUILDS: "builds",
} as const;
export type GarageSection = (typeof GarageSection)[keyof typeof GarageSection];

interface Tab {
  section: GarageSection;
  label: string;
  items(build: Build, unlocks: Unlocks): Item[];
}

export const TABS: Tab[] = [
  { section: GarageSection.BODY, label: "Body", items: (b, u) => [CAR_ITEM, ...part_items(BODY_SLOTS), decal_item(b, u), ...(DECALS[b.decal] === "number" ? [NUMBER_ITEM] : [])] },
  { section: GarageSection.PERFORMANCE, label: "Performance", items: () => part_items(SLOT_NAMES.filter((slot) => !BODY_SLOTS.includes(slot))) },
  { section: GarageSection.PAINT, label: "Paint", items: (b, u) => [paint_item(b, u), ...(DECALS[b.decal] === "none" ? [] : [INK_ITEM])] },
  { section: GarageSection.BUILDS, label: "My builds", items: () => [] },
];

export const BUILDS_TAB = TABS.findIndex((tab) => tab.section === GarageSection.BUILDS);

const SLOT_ICONS = new Set(["engine", "tyres", "aero", "suspension", "brakes", "weight", "bias", "nitro", "decal", "number", "ink"]);

/** The sprite icon for a slot or option kind. */
export const slot_icon = (id: string) => (id === "car" || id === "paint" ? `icon-${id}` : `icon-slot-${SLOT_ICONS.has(id) ? id : "part"}`);
