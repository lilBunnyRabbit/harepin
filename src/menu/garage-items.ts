import { DECALS, MAX_NUMBER, SLOTS, SLOT_NAMES, WHOLE_CAR, part_of, slot_view, type Build, type Decal, type Slot, type SlotView } from "../car/build";
import { CARS, is_car } from "../car/cars";
import { NEUTRAL_INKS, car_paints, decal_inks } from "../theme/palette";

const DECAL_NAMES: Record<Decal, string> = {
  none: "None",
  centre: "Centre stripe",
  twin: "Twin stripes",
  side: "Side stripe",
  number: "Number",
  flames: "Flames",
  slash: "Slash",
  checker: "Checker",
  rabbit: "Rabbit",
};

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

const DECAL_ITEM: Item = {
  id: "decal",
  label: "Decal",
  kind: "decal",
  view: SIDE_VIEW,
  count: DECALS.length,
  at: (b) => b.decal,
  with: (b, i) => ({ ...b, decal: i }),
  name: (i) => DECAL_NAMES[DECALS[i]],
  blurb: () => "",
};

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

const PAINT_ITEM: Item = {
  id: "paint",
  label: "Paint",
  kind: "paint",
  view: WHOLE_CAR,
  count: car_paints.length,
  at: (b) => b.paint % car_paints.length,
  with: (b, i) => ({ ...b, paint: i }),
  name: (i) => `Paint ${i + 1}`,
  blurb: () => "",
};

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
  items(build: Build): Item[];
}

export const TABS: Tab[] = [
  { section: GarageSection.BODY, label: "Body", items: (b) => [CAR_ITEM, ...part_items(BODY_SLOTS), DECAL_ITEM, ...(DECALS[b.decal] === "number" ? [NUMBER_ITEM] : [])] },
  { section: GarageSection.PERFORMANCE, label: "Performance", items: () => part_items(SLOT_NAMES.filter((slot) => !BODY_SLOTS.includes(slot))) },
  { section: GarageSection.PAINT, label: "Paint", items: (b) => [PAINT_ITEM, ...(DECALS[b.decal] === "none" ? [] : [INK_ITEM])] },
  { section: GarageSection.BUILDS, label: "My builds", items: () => [] },
];

export const BUILDS_TAB = TABS.findIndex((tab) => tab.section === GarageSection.BUILDS);
