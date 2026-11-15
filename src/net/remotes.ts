import * as THREE from "three";
import { DEFAULT_BUILD, build_code, build_spec, parse_build, type Build } from "../car/build";
import { oversize, type CarSpec } from "../car/cars";
import { contact_shadow, fit_contact_shadow, place_contact_shadow, type ContactShadow } from "../car/contact-shadow";
import { chunk_of } from "../worldgen/chunk-grid";
import { BRAKE_REST, brake_on, set_lights, show_flame, snap_lights, swing_popups } from "../car/lights";
import { build_view, camera_fade, dispose_car_view, rest_wheels, type CarView } from "../car/models";
import { stand_on_lifts, wheel_lifts } from "../car/drawn-stand";
import { Scrape } from "../car/car";
import { Sparks } from "../render/sparks";
import type { Collider, World } from "../world/world";
import { tier_badge, tier_look } from "../career/badge";
import { title_text } from "../runs/season";
import { set_text } from "../hud/hud";
import type { CarState, Net, Remote, TierBadge } from "./net";
import "./remotes.css";

type Snapshot = Remote["snapshots"][number];

interface Probe extends Collider {
  heading: number;
  spec: CarSpec;
}

interface RemoteView {
  code: string;
  /** `performance.now()` of the last view build. */
  built: number;
  spec: CarSpec;
  view: CarView;
  materials: THREE.Material[];
  shadow: ContactShadow;
  sparks: Sparks;
  /** The drawn pose held against the solids each frame, for the sparks: a peer's packet carries no contacts. */
  probe: Probe;
  label: HTMLElement;
  name: HTMLElement;
  tier: TierBadge | null;
  /** The season tag shown, as `title|tint`. */
  tag: string;
  /** Name label height over the car origin, metres. */
  above: number;
  spin: number;
  /** Last drawn heading, radians, for the yaw rate the nitro flame sways by. */
  heading: number;
  /** The two snapshots `lift_sets` hold the drawn lifts of: one per wheel, then the body centre's for the contact shadow. */
  lift_snaps: [Snapshot | null, Snapshot | null];
  lift_sets: [number[], number[]];
  /** This frame's lifts, eased between the two snapshots'. */
  lifts: number[];
  /** What the label was last given, so an unmoved label writes nothing: shown, and its spot in CSS px. */
  shown: boolean | null;
  at_x: number;
  at_y: number;
}

const ABOVE = 2.2;
/** Milliseconds a car runs on along its last velocity once its packets stop, before it holds still. */
const HOLD_AHEAD_MS = 250;
/** Metres off a face that still count as touching it: the peer's own step pushed its car back onto the face, and the packet rounds it. */
const TOUCH_GAP = 0.05;
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
function translucent_view(build: Build, spec: CarSpec, lights: boolean): { view: CarView; materials: THREE.Material[] } {
  const view = build_view(build, spec);
  rest_wheels(view, spec);
  snap_lights(view, lights);
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
  private width = 0;
  private height = 0;

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
      if (found && !(distance < this.near.distance)) continue;
      found = true;
      this.near.id = id;
      this.near.distance = distance;
    }
    return found ? this.near : null;
  }

  update(dt: number, camera: THREE.Camera, me: THREE.Vector3) {
    // Read once before any label is written: a viewport read after a style write forces a layout, once per remote.
    this.width = innerWidth;
    this.height = innerHeight;
    for (const remote of this.net.remotes.values()) this.draw(remote, dt, camera, me);
    for (const [id, rv] of this.views)
      if (!this.net.remotes.has(id)) {
        this.scene.remove(rv.view.root, rv.shadow.mesh, rv.sparks.mesh);
        dispose_car_view(rv.view);
        rv.sparks.dispose();
        rv.shadow.mesh.geometry.dispose();
        rv.shadow.material.dispose();
        rv.label.remove();
        this.views.delete(id);
      }
  }

  /**
   * The drawn lifts at `snap`'s pose, worked out once per snapshot rather than every frame: `World.drawn_lift` is the
   * dearest part of drawing a remote, and a pose only changes when a packet lands. `keep` is the other snapshot in use.
   */
  private lifts_at(rv: RemoteView, snap: Snapshot, keep: Snapshot): number[] {
    const { lift_snaps, lift_sets } = rv;
    if (lift_snaps[0] === snap) return lift_sets[0];
    if (lift_snaps[1] === snap) return lift_sets[1];
    const slot = lift_snaps[0] === keep ? 1 : 0;
    const out = lift_sets[slot];
    const { p, q } = snap.state;
    this.p1.set(...p);
    this.q1.set(...q);
    wheel_lifts(rv.view, this.p1, this.q1, this.world, out);
    out[rv.view.wheels.length] = this.world.drawn_lift(p[0], p[2], p[1]);
    lift_snaps[slot] = snap;
    return out;
  }

  private draw(remote: Remote, dt: number, camera: THREE.Camera, me: THREE.Vector3) {
    const { build, code } = build_of(remote.latest);
    let rv = this.views.get(remote.id);
    const now = performance.now();
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
    // The lamps start from the same delayed state the frame draws, or a fresh view would swing to catch up with it.
    const lights = b.state.lights ?? true;
    if (rv && rv.code !== code && now - rv.built >= REBUILD_GAP_MS) {
      this.scene.remove(rv.view.root);
      dispose_car_view(rv.view);
      const spec = build_spec(build);
      Object.assign(rv, { code, spec, built: now, above: ABOVE * oversize(spec).height }, translucent_view(build, spec, lights));
      rv.lift_snaps[0] = rv.lift_snaps[1] = null;
      rv.probe.spec = spec;
      fit_contact_shadow(rv.shadow, spec);
      this.scene.add(rv.view.root);
    }
    if (!rv) {
      const spec = build_spec(build);
      const { view, materials } = translucent_view(build, spec, lights);
      this.scene.add(view.root);
      const label = document.createElement("div");
      label.className = "label";
      const name = document.createElement("span");
      label.append(name);
      this.labels.append(label);
      const shadow = contact_shadow();
      fit_contact_shadow(shadow, spec);
      const sparks = new Sparks();
      this.scene.add(shadow.mesh, sparks.mesh);
      const probe: Probe = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), ang: new THREE.Vector3(), heading: 0, scrape: new Scrape(), spec };
      rv = { code, built: now, spec, view, materials, shadow, sparks, probe, label, name, tier: null, tag: "", above: ABOVE * oversize(spec).height, spin: 0, heading: 0, lift_snaps: [null, null], lift_sets: [[], []], lifts: [], shown: null, at_x: NaN, at_y: NaN };
      this.views.set(remote.id, rv);
    }
    const root = rv.view.root;
    let k = 1;
    const { probe } = rv;
    if (t >= b.at) {
      const ahead = Math.min(HOLD_AHEAD_MS, t - b.at) / 1000;
      const s = b.state;
      // Past the cap the car holds still, so it has nothing left to scrape with.
      if (t - b.at < HOLD_AHEAD_MS) probe.vel.set(...s.v);
      else probe.vel.set(0, 0, 0);
      root.position.set(s.p[0] + s.v[0] * ahead, s.p[1] + s.v[1] * ahead, s.p[2] + s.v[2] * ahead);
      root.quaternion.set(...s.q);
    } else {
      k = b.at > a.at ? Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at))) : 1;
      root.position.set(...a.state.p).lerp(this.p1.set(...b.state.p), k);
      root.quaternion.copy(this.q0.set(...a.state.q).slerp(this.q1.set(...b.state.q), k));
      // The earlier snapshot's: the later one is often already the bounce off the face, its speed into it gone.
      probe.vel.set(...a.state.v);
    }
    this.forward.set(0, 0, 1).applyQuaternion(root.quaternion);
    const heading = Math.atan2(this.forward.x, this.forward.z);
    probe.pos.copy(root.position);
    probe.heading = heading;
    rest_wheels(rv.view, rv.spec);
    const from = this.lifts_at(rv, a, b);
    const to = this.lifts_at(rv, b, a);
    for (let i = 0; i < from.length; i++) rv.lifts[i] = from[i] + (to[i] - from[i]) * k;
    stand_on_lifts(rv.view, rv.lifts);
    // A chunk that has not streamed in reads as flat sea level: no shadow there rather than one far under the car.
    const { tiles } = this.world;
    rv.shadow.mesh.visible = tiles.get(chunk_of(root.position.x, root.position.z, tiles.ext)) !== undefined;
    if (rv.shadow.mesh.visible) place_contact_shadow(rv.shadow, root.position.x, root.position.y, root.position.z, heading, this.world, rv.lifts[rv.view.wheels.length]);
    const s = b.state;
    rv.spin += (Math.hypot(...s.v) / rv.spec.wheel.radius) * dt;
    rv.view.wheels.forEach((w, i) => {
      w.rotation.y = rv.view.steered[i] ? -s.steer : 0;
      w.children[0].rotation.x = rv.spin;
    });
    rv.view.brake.emissiveIntensity = s.brake ? brake_on.value : BRAKE_REST;
    const turned = Math.atan2(Math.sin(heading - rv.heading), Math.cos(heading - rv.heading));
    rv.heading = heading;
    show_flame(rv.view, s.boost === true, now / 1000, dt > 0 ? turned / dt : 0);
    if (rv.view.lights !== lights) set_lights(rv.view, lights);
    swing_popups(rv.view, now / 1000);
    // Remote cars are ghosts with no collision, so one sitting inside yours fades out instead of hiding your car.
    const opacity = Math.min(Math.max(0.22, Math.min(1, (root.position.distanceTo(me) - 3) / 9)), camera_fade(root.position, camera.position));
    root.visible = opacity > 0;
    // Hidden, it scrapes nothing new, but what it threw still flies out.
    if (root.visible) this.world.touches(probe, TOUCH_GAP);
    rv.sparks.update(dt, probe);
    for (const material of rv.materials) {
      material.opacity = opacity;
      material.depthWrite = opacity > 0.99;
    }
    this.screen.copy(root.position);
    this.screen.y += rv.above;
    this.screen.project(camera);
    const visible = this.screen.z < 1 && root.position.distanceTo(camera.position) < 400;
    if (visible !== rv.shown) {
      rv.shown = visible;
      rv.label.style.display = visible ? "" : "none";
    }
    if (visible) {
      const name = this.net.display_name(remote);
      set_text(rv.name, name);
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
        const look = tier ? tier_look(tier) : null;
        if (look?.weave) {
          rv.label.dataset.weave = "";
          rv.label.style.setProperty("--metal", look.metal);
          rv.label.style.setProperty("--weave", look.weave);
        } else delete rv.label.dataset.weave;
      }
      const x = ((this.screen.x + 1) / 2) * this.width;
      const y = ((1 - this.screen.y) / 2) * this.height;
      if (x !== rv.at_x || y !== rv.at_y) {
        rv.at_x = x;
        rv.at_y = y;
        rv.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    }
  }
}
