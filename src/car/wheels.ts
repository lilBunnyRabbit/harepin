import * as THREE from "three";
import type { Look } from "./build";
import type { Rim } from "./designs";
import { merge, tint } from "./geometry";
import { brand, color, mix, tones } from "../theme/palette";

export const STOCK_TYRE: Required<Look>["tyre"] = { width: 1, rim: 1 };
export const STOCK_CALIPER: Required<Look>["caliper"] = { size: 1 };
const TREAD_BLOCKS = 12;

export const chrome_tone = () => color(mix(brand.foreground, brand.background_lightest, 0.6));
const RIM_TONES: Record<Rim["tone"], () => THREE.Color> = {
  metal: chrome_tone,
  light: () => color(tones.check_light),
  bronze: () => color(mix(brand.warning, tones.trim, 0.7)),
};

export function wheel_geometry(radius: number, width: number, rim: Rim, look: Required<Look>["tyre"]): THREE.BufferGeometry {
  const tone = RIM_TONES[rim.tone]();
  const wide = width * look.width;
  const disc = radius * rim.size * look.rim;
  const rubber = color(tones.tyre);
  const pieces = [
    tint(new THREE.CylinderGeometry(radius, radius, wide, 8).rotateZ(Math.PI / 2), rubber),
    tint(new THREE.CylinderGeometry(disc, disc, wide + 0.02, 8).rotateZ(Math.PI / 2), rim.spokes ? color(tones.trim) : tone),
  ];
  // A dished rim: the lip is the polished disc's rim, the dark dish covers its centre and the spokes stand on the dish.
  const face = rim.lip ? disc * (1 - rim.lip) : disc;
  const step = rim.lip ? 0.01 : 0;
  if (rim.lip) {
    pieces[1] = tint(new THREE.CylinderGeometry(disc, disc, wide + 0.02, 8).rotateZ(Math.PI / 2), color(tones.check_light));
    pieces.push(tint(new THREE.CylinderGeometry(face, face, wide + 0.03, 8).rotateZ(Math.PI / 2), color(tones.tyre)));
  }
  for (let i = 0; i < rim.spokes; i++) pieces.push(tint(new THREE.BoxGeometry(wide + 0.04 + step, face * 1.9, rim.spoke ?? 0.06).rotateX((i * Math.PI) / rim.spokes), tone));
  if (rim.spokes) pieces.push(tint(new THREE.CylinderGeometry(face * 0.3, face * 0.3, wide + 0.05 + step, 6).rotateZ(Math.PI / 2), tone));
  if (look.band) pieces.push(tint(new THREE.CylinderGeometry(disc + 0.022, disc + 0.022, wide + 0.01, 8).rotateZ(Math.PI / 2), color(brand[look.band])));
  if (look.tread)
    for (let i = 0; i < TREAD_BLOCKS; i++)
      pieces.push(tint(new THREE.BoxGeometry(wide * 0.46, 0.05 * look.tread, 0.1 * look.tread).translate((i % 2 ? 1 : -1) * wide * 0.26, radius, 0).rotateX((i * 2 * Math.PI) / TREAD_BLOCKS), rubber));
  return merge(...pieces);
}

// Fixed to the steering knuckle, not the spinning wheel. Stock hides behind the spokes; an upgrade sits proud of them so
// its colour reads at speed and on disc rims.
export function caliper_geometry(radius: number, width: number, rim: Rim, look: Required<Look>["tyre"], { size, tone }: Required<Look>["caliper"]): THREE.BufferGeometry {
  const disc = radius * rim.size * look.rim;
  const proud = tone ? 0.046 : 0.03;
  return tint(new THREE.BoxGeometry(width * look.width + proud, disc * 0.3 * size, disc * 0.5 * size).translate(0, disc * 0.68, 0).rotateX(-0.8), color(tone ? brand[tone] : tones.trim));
}
