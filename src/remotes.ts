import * as THREE from "three";
import { DEFAULT_BUILD, build_code, build_spec, parse_build, type Build } from "./build";
import type { CarSpec } from "./cars";
import { car_view, contact_shadow, dispose_car_view, place_contact_shadow, rest_wheels, type CarView, type ContactShadow } from "./models";
import type { World } from "./world";
import type { CarState, Net, Remote } from "./net";
import { car_paints, color } from "./palette";

interface RemoteView {
  code: string;
  spec: CarSpec;
  view: CarView;
  materials: THREE.Material[];
  shadow: ContactShadow;
  label: HTMLElement;
  spin: number;
}

const ABOVE = new THREE.Vector3(0, 2.2, 0);

// Peers that predate build codes only send a paint index; they show as a stock coupe in that paint.
function build_of(state: CarState): Build {
  const code = "b" in state ? state.b : undefined;
  return parse_build(code) ?? { ...DEFAULT_BUILD, paint: state.paint };
}

// Each remote gets its own material copies so its fade never touches another car.
function translucent_view(build: Build, spec: CarSpec): { view: CarView; materials: THREE.Material[] } {
  const view = car_view(color(car_paints[build.paint % car_paints.length]), spec, build.spoiler);
  rest_wheels(view, spec);
  const copies = new Map<THREE.Material, THREE.Material>();
  view.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
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
    const build = build_of(remote.latest);
    const code = build_code(build);
    let rv = this.views.get(remote.id);
    if (rv && rv.code !== code) {
      this.scene.remove(rv.view.root);
      dispose_car_view(rv.view);
      const spec = build_spec(build);
      Object.assign(rv, { code, spec }, translucent_view(build, spec));
      this.scene.add(rv.view.root);
    }
    if (!rv) {
      const spec = build_spec(build);
      const { view, materials } = translucent_view(build, spec);
      this.scene.add(view.root);
      const label = document.createElement("div");
      label.className = "label";
      this.labels.append(label);
      const shadow = contact_shadow();
      this.scene.add(shadow.mesh);
      rv = { code, spec, view, materials, shadow, label, spin: 0 };
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
    place_contact_shadow(rv.shadow, root.position.x, root.position.y, root.position.z, Math.atan2(this.forward.x, this.forward.z), this.world);
    const s = b.state;
    rv.spin += (Math.hypot(...s.v) / rv.spec.wheel.radius) * dt;
    rv.view.wheels.forEach((w, i) => {
      w.rotation.y = i < 2 ? -s.steer : 0;
      w.children[0].rotation.x = rv.spin;
    });
    rv.view.brake.emissiveIntensity = s.brake ? 2.2 : 0.5;
    // Remote cars are ghosts with no collision, so one sitting inside yours fades out instead of hiding your car.
    const opacity = Math.max(0.22, Math.min(1, (root.position.distanceTo(me) - 3) / 9));
    for (const material of rv.materials) {
      material.opacity = opacity;
      material.depthWrite = opacity > 0.99;
    }
    this.screen.copy(root.position).add(ABOVE).project(camera);
    const visible = this.screen.z < 1 && root.position.distanceTo(camera.position) < 400;
    rv.label.style.display = visible ? "block" : "none";
    if (visible) {
      rv.label.textContent = this.net.display_name(remote);
      rv.label.style.transform = `translate(${((this.screen.x + 1) / 2) * innerWidth}px, ${((1 - this.screen.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
    }
  }
}
