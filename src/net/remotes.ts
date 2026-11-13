import * as THREE from "three";
import { DEFAULT_BUILD, build_code, build_spec, parse_build, type Build } from "../car/build";
import { oversize, type CarSpec } from "../car/cars";
import { contact_shadow, fit_contact_shadow, place_contact_shadow, type ContactShadow } from "../car/contact-shadow";
import { chunk_of } from "../worldgen/chunk-grid";
import { show_flame } from "../car/lights";
import { build_view, camera_fade, dispose_car_view, rest_wheels, type CarView } from "../car/models";
import type { World } from "../world/world";
import { tier_badge } from "../career/badge";
import { title_text } from "../runs/season";
import type { CarState, Net, Remote, TierBadge } from "./net";
import "./remotes.css";

interface RemoteView {
  code: string;
  /** `performance.now()` of the last view build. */
  built: number;
  spec: CarSpec;
  view: CarView;
  materials: THREE.Material[];
  shadow: ContactShadow;
  label: HTMLElement;
  name: HTMLElement;
  tier: TierBadge | null;
  /** The season tag shown, as `title|tint`. */
  tag: string;
  /** Name label height over the car origin, metres. */
  above: number;
  spin: number;
}

const ABOVE = 2.2;
// A peer flicking through the garage would otherwise rebuild geometry every packet; the latest code wins after the gap.
const REBUILD_GAP_MS = 1000;

// Peers that predate build codes only send a paint index; they show as a stock coupe in that paint.
interface Nearest {
  id: string;
  distance: number;
}

interface Resolved {
  build: Build;
  code: string;
}

/** Distinct build codes kept parsed; a peer cycling codes only ever costs a reparse once this fills. */
const RESOLVED_CAP = 64;
const resolved = new Map<string, Resolved | null>();

function resolve(build: Build): Resolved {
  return { build, code: build_code(build) };
}

function build_of(state: CarState): Resolved {
  const code = "b" in state ? state.b : undefined;
  if (code === undefined) return resolve({ ...DEFAULT_BUILD, paint: state.paint });
  let hit = resolved.get(code);
  if (hit === undefined) {
    if (resolved.size >= RESOLVED_CAP) resolved.clear();
    const build = parse_build(code);
    hit = build && resolve(build);
    resolved.set(code, hit);
  }
  return hit ?? resolve({ ...DEFAULT_BUILD, paint: state.paint });
}

// Each remote gets its own material copies so its fade never touches another car.
function translucent_view(build: Build, spec: CarSpec): { view: CarView; materials: THREE.Material[] } {
  const view = build_view(build, spec);
  rest_wheels(view, spec);
  const copies = new Map<THREE.Material, THREE.Material>();
  view.root.traverse((object) => {
    // The flame stays additive with no depth write; a faded copy would turn it into a see-through solid.
    if (!(object instanceof THREE.Mesh) || object === view.flame) return;
    const original = object.material as THREE.Material;
    let copy = copies.get(original);
    if (!copy) {
      copy = original.clone();
      copy.transparent = true;
      copies.set(original, copy);
    }
    object.material = copy;
  });
  view.brake = (copies.get(view.brake) ?? view.brake) as THREE.MeshLambertMaterial;
  return { view, materials: [...copies.values()] };
}

export class Remotes {
  private views = new Map<string, RemoteView>();
  private readonly near: Nearest = { id: "", distance: 0 };
  private q0 = new THREE.Quaternion();
  private q1 = new THREE.Quaternion();
  private p1 = new THREE.Vector3();
  private screen = new THREE.Vector3();
  private forward = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    private labels: HTMLElement,
    private net: Net,
    private world: World,
  ) {}

  /** The peer car nearest `to` where it is drawn (interpolated), and how far away it is in metres. The result is reused by the next call. */
  nearest(to: THREE.Vector3): Readonly<Nearest> | null {
    let found = false;
    for (const [id, rv] of this.views) {
      const distance = rv.view.root.position.distanceTo(to);
      if (found && distance >= this.near.distance) continue;
      found = true;
      this.near.id = id;
      this.near.distance = distance;
    }
    return found ? this.near : null;
  }

  update(dt: number, camera: THREE.Camera, me: THREE.Vector3) {
    for (const remote of this.net.remotes.values()) this.draw(remote, dt, camera, me);
    for (const [id, rv] of this.views)
      if (!this.net.remotes.has(id)) {
        this.scene.remove(rv.view.root, rv.shadow.mesh);
        dispose_car_view(rv.view);
        rv.shadow.mesh.geometry.dispose();
        rv.shadow.material.dispose();
        rv.label.remove();
        this.views.delete(id);
      }
  }

  private draw(remote: Remote, dt: number, camera: THREE.Camera, me: THREE.Vector3) {
    const { build, code } = build_of(remote.latest);
    let rv = this.views.get(remote.id);
    const now = performance.now();
    if (rv && rv.code !== code && now - rv.built >= REBUILD_GAP_MS) {
      this.scene.remove(rv.view.root);
      dispose_car_view(rv.view);
      const spec = build_spec(build);
      Object.assign(rv, { code, spec, built: now, above: ABOVE * oversize(spec).height }, translucent_view(build, spec));
      fit_contact_shadow(rv.shadow, spec);
      this.scene.add(rv.view.root);
    }
    if (!rv) {
      const spec = build_spec(build);
      const { view, materials } = translucent_view(build, spec);
      this.scene.add(view.root);
      const label = document.createElement("div");
      label.className = "label";
      const name = document.createElement("span");
      label.append(name);
      this.labels.append(label);
      const shadow = contact_shadow();
      fit_contact_shadow(shadow, spec);
      this.scene.add(shadow.mesh);
      rv = { code, built: now, spec, view, materials, shadow, label, name, tier: null, tag: "", above: ABOVE * oversize(spec).height, spin: 0 };
      this.views.set(remote.id, rv);
    }
    const t = this.net.render_time(remote);
    const snaps = remote.snapshots;
    let a = snaps[0];
    let b = snaps[snaps.length - 1];
    for (let i = snaps.length - 1; i > 0; i--)
      if (snaps[i - 1].at <= t) {
        a = snaps[i - 1];
        b = snaps[i];
        break;
      }
    const root = rv.view.root;
    if (t >= b.at) {
      const ahead = Math.min(250, t - b.at) / 1000;
      const s = b.state;
      root.position.set(s.p[0] + s.v[0] * ahead, s.p[1] + s.v[1] * ahead, s.p[2] + s.v[2] * ahead);
      root.quaternion.set(...s.q);
    } else {
      const k = b.at > a.at ? Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at))) : 1;
      root.position.set(...a.state.p).lerp(this.p1.set(...b.state.p), k);
      root.quaternion.copy(this.q0.set(...a.state.q).slerp(this.q1.set(...b.state.q), k));
    }
    this.forward.set(0, 0, 1).applyQuaternion(root.quaternion);
    // A chunk that has not streamed in reads as flat sea level: no shadow there rather than one far under the car.
    const { tiles } = this.world;
    rv.shadow.mesh.visible = tiles.get(chunk_of(root.position.x, root.position.z, tiles.ext)) !== undefined;
    if (rv.shadow.mesh.visible) place_contact_shadow(rv.shadow, root.position.x, root.position.y, root.position.z, Math.atan2(this.forward.x, this.forward.z), this.world);
    const s = b.state;
    rv.spin += (Math.hypot(...s.v) / rv.spec.wheel.radius) * dt;
    rv.view.wheels.forEach((w, i) => {
      w.rotation.y = rv.view.steered[i] ? -s.steer : 0;
      w.children[0].rotation.x = rv.spin;
    });
    rv.view.brake.emissiveIntensity = s.brake ? 2.2 : 0.5;
    show_flame(rv.view, s.boost === true, now / 1000);
    // Remote cars are ghosts with no collision, so one sitting inside yours fades out instead of hiding your car.
    const opacity = Math.min(Math.max(0.22, Math.min(1, (root.position.distanceTo(me) - 3) / 9)), camera_fade(root.position, camera.position));
    root.visible = opacity > 0;
    for (const material of rv.materials) {
      material.opacity = opacity;
      material.depthWrite = opacity > 0.99;
    }
    this.screen.copy(root.position);
    this.screen.y += rv.above;
    this.screen.project(camera);
    const visible = this.screen.z < 1 && root.position.distanceTo(camera.position) < 400;
    rv.label.style.display = visible ? "" : "none";
    if (visible) {
      const name = this.net.display_name(remote);
      if (rv.name.textContent !== name) rv.name.textContent = name;
      const hello = this.net.hellos.get(remote.id);
      const tier = hello?.tier ?? null;
      const tag = `${hello?.tag?.title ?? ""}|${hello?.tag?.tint ?? ""}`;
      if (tier !== rv.tier || tag !== rv.tag) {
        rv.tier = tier;
        rv.tag = tag;
        const title = hello?.tag?.title ? title_text(hello.tag.title) : null;
        const shown = title ? [Object.assign(document.createElement("small"), { className: "label-title", textContent: title })] : [];
        rv.label.replaceChildren(...(tier ? [tier_badge(tier)] : []), rv.name, ...shown);
        if (hello?.tag?.tint) rv.label.style.setProperty("--tag-tint", `var(--${hello.tag.tint})`);
        else rv.label.style.removeProperty("--tag-tint");
      }
      rv.label.style.transform = `translate(${((this.screen.x + 1) / 2) * innerWidth}px, ${((1 - this.screen.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
    }
  }
}
