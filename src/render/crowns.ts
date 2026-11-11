import { mix, tones } from "../theme/palette";
import { TreeKind } from "../worldgen/biomes";
import type { Lab } from "../theme/theme";

// Pines hold the most snow on their tiers, broadleaf crowns the least; scrub sits half buried.
const SNOWY_CROWNS: Record<TreeKind, number> = { [TreeKind.PINE]: 0.55, [TreeKind.BROADLEAF]: 0.35, [TreeKind.SCRUB]: 0.6 };

/** A crown's tone: leaf mixed by its `shade` jitter, with the kind's share of snow on a snowy map. */
export function crown_tone(kind: TreeKind, shade: number, snowy: boolean): Lab {
  const leafy = kind === TreeKind.SCRUB ? mix(tones.leaf, tones.grass_dry, 0.45 + shade * 0.5) : mix(tones.leaf, tones.leaf_dark, 0.5 + shade * 1.6);
  return snowy ? mix(tones.snow, leafy, SNOWY_CROWNS[kind]) : leafy;
}
