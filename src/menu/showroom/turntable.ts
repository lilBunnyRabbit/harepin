import * as THREE from "three";
import { brand, color } from "../../theme/palette";

/** Camera distance over the tightest fit: the turntable fills its own room, so the fit keeps only a little air past its rim. */
export const TURNTABLE_SLACK = 1.3;
const SIDES = 96;
const FADE_PX = 128;
/** Floor opacity at the hub and at the rim: the world behind shows through the outer disc. */
const HUB_ALPHA = 1;
const RIM_ALPHA = 0.94;
const RIM = [0.985, 1] as const;
const GROOVE = [0.7, 0.708] as const;
const LINE_ALPHA = 0.7;

// An alpha map reads the green channel, so the fade is painted in opaque greys, as the contact shadow's blob is.
function fade(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = FADE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("showroom: no 2d canvas for the turntable");
  const r = FADE_PX / 2;
  const grey = (alpha: number) => `rgb(${Math.round(alpha * 255)} ${Math.round(alpha * 255)} ${Math.round(alpha * 255)})`;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, grey(HUB_ALPHA));
  gradient.addColorStop(1, grey(RIM_ALPHA));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FADE_PX, FADE_PX);
  return new THREE.CanvasTexture(canvas);
}

/** Unlit, so the stage light never tints it; a unit disc that `CarStage` scales to the car. */
export function turntable(): THREE.Group {
  const group = new THREE.Group();
  const floor = new THREE.MeshBasicMaterial({ color: color(brand.background), alphaMap: fade(), transparent: true, depthWrite: false });
  const line = new THREE.MeshBasicMaterial({ color: color(brand.background_lighter), transparent: true, opacity: LINE_ALPHA, depthWrite: false });
  const ring = ([inner, outer]: readonly [number, number]) => new THREE.Mesh(new THREE.RingGeometry(inner, outer, SIDES).rotateX(-Math.PI / 2), line);
  const rim = ring(RIM);
  const groove = ring(GROOVE);
  // Drawn after the floor at the same height: the order, not depth, keeps the lines on top.
  rim.renderOrder = groove.renderOrder = 1;
  group.add(new THREE.Mesh(new THREE.CircleGeometry(1, SIDES).rotateX(-Math.PI / 2), floor), rim, groove);
  return group;
}
