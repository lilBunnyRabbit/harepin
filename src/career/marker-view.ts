import * as THREE from "three";
import { brand, color, locked_tone, rgba, tier_metals, tones } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { MARKER_REACH, type Marker } from "./markers";

const POST = { width: 0.18, height: 4.4 };
const FLAG = { width: 2.2, height: 1.3, depth: 0.06 };
const TEXTURE = { width: 256, height: 152 };
const CHECKS = 8;
const RING = 0.35;
const LIFT = 0.08;
const RING_OPACITY = 0.5;

// Which neutral is darker flips with the theme; the id takes the one far from its metal.
const [INK_DARK, INK_LIGHT] = [brand.background_darkest, brand.foreground].sort((a, b) => a[0] - b[0]);

export const marker_tone = (marker: Marker, open: boolean): Lab => (open ? tier_metals[marker.tier] : locked_tone);

interface Flag {
  marker: Marker;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  post: THREE.MeshLambertMaterial;
  ring: THREE.MeshBasicMaterial;
  open: boolean | null;
}

function paint(canvas: HTMLCanvasElement, id: string, metal: Lab, font: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.fillStyle = rgba(metal);
  ctx.fillRect(0, 0, width, height);
  const size = width / CHECKS;
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < CHECKS; col++) {
      ctx.fillStyle = rgba((row + col) % 2 ? tones.check_dark : tones.check_light);
      ctx.fillRect(col * size, row * size * 0.5, size, size * 0.5);
    }
  ctx.fillStyle = rgba(metal[0] > 0.6 ? INK_DARK : INK_LIGHT);
  ctx.font = `800 ${Math.round(height * 0.55)}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(id, width / 2, size + (height - size) / 2);
}

export class MarkerView {
  readonly root = new THREE.Group();
  private readonly flags: Flag[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly font = getComputedStyle(document.body).fontFamily;

  constructor(markers: readonly Marker[], height: (x: number, z: number) => number) {
    const post = new THREE.BoxGeometry(POST.width, POST.height, POST.width).translate(0, POST.height / 2, 0);
    const cloth = new THREE.BoxGeometry(FLAG.width, FLAG.height, FLAG.depth).translate(FLAG.width / 2 + POST.width / 2, POST.height - FLAG.height / 2, 0);
    const ring = new THREE.RingGeometry(MARKER_REACH - RING, MARKER_REACH, 40).rotateX(-Math.PI / 2);
    this.geometries.push(post, cloth, ring);
    for (const marker of markers) {
      const canvas = document.createElement("canvas");
      canvas.width = TEXTURE.width;
      canvas.height = TEXTURE.height;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const flag: Flag = {
        marker,
        canvas,
        texture,
        post: new THREE.MeshLambertMaterial(),
        ring: new THREE.MeshBasicMaterial({ transparent: true, opacity: RING_OPACITY, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
        open: null,
      };
      const group = new THREE.Group();
      const pole = new THREE.Mesh(post, flag.post);
      const banner = new THREE.Mesh(cloth, new THREE.MeshLambertMaterial({ map: texture }));
      pole.castShadow = banner.castShadow = true;
      // Facing along the road, hung toward it from the post: the id reads to whoever drives up to the start.
      const top = new THREE.Group();
      top.rotation.y = marker.heading;
      top.add(pole, banner);
      const base = new THREE.Mesh(ring, flag.ring);
      base.position.y = LIFT;
      group.add(top, base);
      group.position.set(marker.x, height(marker.x, marker.z), marker.z);
      this.root.add(group);
      this.flags.push(flag);
    }
  }

  show(open: (marker: Marker) => boolean) {
    for (const flag of this.flags) {
      const now = open(flag.marker);
      if (now === flag.open) continue;
      flag.open = now;
      const tone = marker_tone(flag.marker, now);
      paint(flag.canvas, flag.marker.event.id, tone, this.font);
      flag.texture.needsUpdate = true;
      flag.post.color = color(now ? tones.beacon : locked_tone);
      flag.ring.color = color(tone);
    }
  }

  dispose() {
    this.root.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    this.root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.Material) node.material.dispose();
    });
    for (const flag of this.flags) flag.texture.dispose();
  }
}
