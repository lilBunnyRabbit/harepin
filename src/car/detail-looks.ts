import * as THREE from "three";
import { part_of, type Slot } from "./build";
import type { Triple } from "./cars";
import type { Detail, Fit, Slab, Swap } from "./designs";
import { parts, slab, tint, type Part } from "./geometry";
import { chrome_tone } from "./wheels";
import { brand, color, tones } from "../theme/palette";

const DRIFT = "Drift";
const LIFTED = "Lifted";

export function fits_of(kit: Record<Slot, number>): Set<Fit> {
  const aero = part_of("aero", kit.aero).look?.aero;
  const suspension = part_of("suspension", kit.suspension).name;
  const fits: [Fit, boolean][] = [
    ["base", true],
    ["lip", (aero?.wing ?? 0) > 0],
    ["wing", (aero?.wing ?? 0) > 1],
    ["street", aero?.skirts === true],
    ["race", aero?.diffuser === true],
    ["tuned", kit.engine > 0],
    ["race_engine", kit.engine > 1],
    ["light", kit.weight > 0],
    ["stripped", kit.weight > 1],
    ["knobbly", part_of("tyres", kit.tyres).look?.tyre?.tread !== undefined],
    ["nitro", kit.nitro > 0],
    ["drift", suspension === DRIFT],
    ["lifted", suspension === LIFTED],
  ];
  return new Set(fits.filter(([, on]) => on).map(([fit]) => fit));
}

export interface DetailLook {
  body: THREE.BufferGeometry[];
  glass: THREE.BufferGeometry[];
  heads: Part[];
  swaps: Set<Swap>;
  exhaust: Triple | null;
  camber: number;
}

const shapes = (list: Slab[] = []) => list.flatMap((s) => slab(s.points, s.from, s.to));

export function detail_look(details: Detail[], kit: Record<Slot, number>, paint: THREE.Color, trim: THREE.Color): DetailLook {
  const look: DetailLook = { body: [], glass: [], heads: [], swaps: new Set(), exhaust: null, camber: 0 };
  const fits = fits_of(kit);
  const chrome = chrome_tone();
  const add = (list: Part[] | undefined, tone: THREE.Color) => look.body.push(...parts(list ?? []).map((g) => tint(g, tone)));
  const bare = paint.clone().lerp(trim, 0.75);
  const on_glass = (list: Part[] | undefined, tone: THREE.Color) => look.glass.push(...parts(list ?? []).map((g) => tint(g, tone)));
  for (const detail of details) {
    if (!fits.has(detail.on) || (detail.until && fits.has(detail.until))) continue;
    add(detail.paint, paint);
    add(detail.trim, trim);
    add(detail.chrome, chrome);
    add(detail.warning, color(brand.warning));
    add(detail.red, color(brand.error));
    add(detail.bright, color(tones.check_light));
    add(detail.accent, color(brand.accent));
    look.body.push(...shapes(detail.lips).map((g) => tint(g, paint)), ...shapes(detail.stands).map((g) => tint(g, trim)));
    add(detail.bare, bare);
    if (detail.tips && fits.has("nitro")) {
      add(detail.tips, color(brand.info));
      look.swaps.add("tips");
    }
    on_glass(detail.cage, chrome);
    on_glass(detail.louvres, paint);
    on_glass(detail.banner, color(tones.check_light));
    look.camber = Math.max(look.camber, detail.camber ?? 0);
    look.heads.push(...(detail.heads ?? []));
    for (const swap of detail.swaps ?? []) look.swaps.add(swap);
    if (detail.exhaust) look.exhaust = detail.exhaust;
  }
  return look;
}
