import * as THREE from "three";
import { axle_index, axles_of } from "./axles";
import { rest_reach, type Car } from "./car";
import { DEFAULT_PARTS, build_spec, part_of, type Build, type Look, type Slot } from "./build";
import { COUPE, type CarSpec, type Triple } from "./cars";
import { body_pieces, body_slabs, cabin_parts, flares, on_glass, sculpt, sculpt_factor, side_panel, skirts, wells } from "./body-shell";
import { DETAILS } from "./car-details";
import { detail_look, type DetailLook } from "./detail-looks";
import { CAR_ORDER } from "./contact-shadow";
import { DESIGNS, type Design } from "./designs";
import { extrude, merge, parts, side_part, tail_at, taper, tint } from "./geometry";
import { lamps, popup, snap_lights, type HeadMesh, type Popup } from "./lights";
import { back, livery_of, livery_parts, roof, type Livery } from "./livery";
import { nitro_flame, type Jet } from "./nitro-look";
import { aero_of, aero_parts, kit_parts, kit_skirts, rear_wing } from "./part-looks";
import { STOCK_CALIPER, STOCK_TYRE, brake_geometry, chrome_tone, wheel_geometry } from "./wheels";
import { paint_finish, paint_lab, type Finish } from "./paint";
import { WEAVE_KEY, weave_shader } from "./carbon";
import { brand, color, dark, mix, tones } from "../theme/palette";
import { sky_ceiling } from "../render/sky";
import type { Lab } from "../theme/theme";

/** A suspension arm hinged on the body, swung so its outer end follows its wheel. */
export interface ArmSwing {
  group: THREE.Group;
  /** Hinge direction in body space; a positive turn about it lifts the wheel end. */
  axis: THREE.Vector3;
  /** Metres in plan from the hinge to the wheel centre. */
  reach: number;
  /** The wheel's suspension reach where the arm sits as drawn. */
  rest: number;
}

export interface CarView {
  root: THREE.Group;
  body: THREE.Group;
  wheels: THREE.Group[];
  /** Per wheel, its swinging arm, or null on a body that draws none. */
  arms: (ArmSwing | null)[];
  /** Per wheel, whether it turns with the steering. */
  steered: boolean[];
  brake: THREE.MeshLambertMaterial;
  /** Headlamp lenses; hidden from the hood camera, which sits right behind them. */
  heads: HeadMesh;
  /** Headlamps on; set through `set_lights`, which also dims `heads`; `swing_popups` swings `popup` after it. */
  lights: boolean;
  /** Pop-up lamp pods, null on fixed lamps. */
  popup: Popup | null;
  /** Hood camera point in car space, or null for the camera's default. */
  eye: THREE.Vector3 | null;
  /** Nitro exhaust flame, hidden until `show_flame`. */
  flame: THREE.Mesh;
  /** The flame's shader uniforms, and the time in seconds `show_flame` last moved them. */
  jet: Jet;
  sway_at: number;
}

export function build_view(build: Build, spec: CarSpec = build_spec(build)): CarView {
  return car_view(color(paint_lab(build.paint)), spec, build.parts, livery_of(build), paint_finish(build.paint));
}

const TONE_MATCH = 1e-4;

// Faces in `tone`, then the rest: a metal paint takes its own lit material, while trim, glass and decals stay matte.
function split_tone(geometry: THREE.BufferGeometry, tone: THREE.Color): [THREE.BufferGeometry, THREE.BufferGeometry] {
  const position = geometry.getAttribute("position");
  const colors = geometry.getAttribute("color");
  const out: [number[], number[]][] = [[[], []], [[], []]];
  for (let i = 0; i < position.count; i += 3) {
    const match = Math.abs(colors.getX(i) - tone.r) + Math.abs(colors.getY(i) - tone.g) + Math.abs(colors.getZ(i) - tone.b) < TONE_MATCH;
    const [p, c] = out[match ? 0 : 1];
    for (let k = i; k < i + 3; k++) {
      p.push(position.getX(k), position.getY(k), position.getZ(k));
      c.push(colors.getX(k), colors.getY(k), colors.getZ(k));
    }
  }
  return out.map(([p, c]) => {
    const part = new THREE.BufferGeometry();
    part.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    part.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    part.computeVertexNormals();
    return part;
  }) as [THREE.BufferGeometry, THREE.BufferGeometry];
}

// A studio strip from theme tokens, bottom to top: dark floor, a wide bright band just under the horizon, a dark gap,
// then soft sky. Without it a metal has nothing to reflect and reads as flat dark paint. A camera a little above the car
// sees upright faces (tail, doors) mirror the band and upward faces (deck, roof) mirror the gap and the sky over it, so
// the faces split light and dark the other way round from a matte paint, which is what reads as metal.
// Light themes' foreground is their darkest ink, so the band and the floor swap tokens there to keep the band bright.
const BAND = dark ? brand.foreground : brand.background_lightest;
const FLOOR = dark ? brand.background_darkest : mix(brand.foreground, brand.background_darkest, 0.55);
const GAP = dark ? brand.background_dark : mix(brand.foreground, brand.background, 0.6);
const SKY = dark ? mix(brand.foreground, brand.background_lightest, 0.4) : brand.background;
const SOFT = mix(BAND, GAP, 0.5);
const STRIP: [number, Lab][] = [
  [0, FLOOR],
  [0.28, FLOOR],
  [0.36, SOFT],
  [0.4, BAND],
  [0.48, BAND],
  [0.53, GAP],
  [0.58, GAP],
  [0.66, SOFT],
  [0.76, SKY],
  [1, SKY],
];
const STRIP_ROWS = 64;
/** Share of the ceiling a metal face reaches before its highlight starts to roll off. */
const SHEEN_KNEE = "0.55";
let strip: THREE.DataTexture | null = null;

function studio(): THREE.DataTexture {
  if (strip) return strip;
  const data = new Float32Array(STRIP_ROWS * 4);
  const tone = new THREE.Color();
  for (let row = 0; row < STRIP_ROWS; row++) {
    const v = row / (STRIP_ROWS - 1);
    const next = STRIP.findIndex(([at]) => at >= v);
    const [a, from] = STRIP[Math.max(0, next - 1)];
    const [b, to] = STRIP[next];
    tone.copy(color(from)).lerp(color(to), b > a ? (v - a) / (b - a) : 0);
    data.set([tone.r, tone.g, tone.b, 1], row * 4);
  }
  strip = new THREE.DataTexture(data, 1, STRIP_ROWS, THREE.RGBAFormat, THREE.FloatType);
  strip.mapping = THREE.EquirectangularReflectionMapping;
  strip.magFilter = THREE.LinearFilter;
  strip.needsUpdate = true;
  return strip;
}

function metal_hull(painted: THREE.BufferGeometry, finish: Finish): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    metalness: finish.metalness,
    roughness: finish.roughness,
    envMap: studio(),
    envMapIntensity: finish.reflect,
  });
  // A flat face at the low sun's mirror angle (roof, deck from behind) lights whole at the specular peak, far over 1, and
  // with no tone mapping clipped white and bloomed. Rolling luma off under the bloom-safe ceiling keeps faces ordered.
  const weave = finish.weave;
  if (weave) material.customProgramCacheKey = () => WEAVE_KEY;
  material.onBeforeCompile = (shader) => {
    if (weave) weave_shader(shader, weave);
    shader.uniforms.ceiling = sky_ceiling;
    shader.fragmentShader = `uniform float ceiling;\n${shader.fragmentShader}`.replace(
      "#include <opaque_fragment>",
      `#include <opaque_fragment>
  float luma = max(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)), 1e-4);
  float knee = ceiling * ${SHEEN_KNEE};
  float rolled = luma <= knee ? luma : knee + (ceiling - knee) * (1.0 - exp((knee - luma) / (ceiling - knee)));
  gl_FragColor.rgb *= rolled / luma;
  gl_FragColor.rgb /= max(1.0, max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)));`,
    );
  };
  const mesh = new THREE.Mesh(painted, material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * The design as a build wears it: the kit's shell over the stock one when the aero part fits skirts, with the lamps and the
 * pipe outlet its details bring, and those details' own look.
 */
export function fitted_design(spec: CarSpec, kit: Record<Slot, number>, paint: THREE.Color, trim: THREE.Color): { d: Design; detail: DetailLook } {
  const stock = DESIGNS[spec.body.style];
  const fitted = aero_of(kit).skirts && stock.kit ? { ...stock, ...stock.kit } : stock;
  const detail = detail_look(DETAILS[spec.body.style], kit, paint, trim);
  // Generic tailpipes leave the fitted shell's own tail face, which a kit sets further back than the stock body's.
  const [x, y, z] = fitted.exhaust;
  const exhaust: Triple = [x, y, Math.min(z, tail_at(fitted.outline, y))];
  return { d: { ...fitted, exhaust, heads: [...fitted.heads, ...detail.heads], ...detail.outlet }, detail };
}

// A tyre's outer face stays this far inside the body side or arch lip over it.
const TYRE_TUCK = 0.005;

/**
 * The tyre look per design axle (front, rear): a wider tyre option narrowed to what the body covers at that axle, and
 * never under the design's own tyre.
 */
function fitted_tyres(d: Design, spec: CarSpec, tyre: Required<Look>["tyre"]): Required<Look>["tyre"][] {
  const axles = axles_of(spec);
  return [0, 1].map((slot) => {
    const room = axles
      .filter((_, i) => Math.min(i, 1) === slot)
      .map((axle) => 2 * ((d.width / 2) * sculpt_factor(d, spec.wheel.radius, axle.z) + d.arches.out - TYRE_TUCK - Math.abs(spec.wheel.mounts[axle.wheels[0]][0])));
    return { ...tyre, width: Math.min(tyre.width, Math.max(1, Math.min(...room) / d.tyre[slot])) };
  });
}

const WALL_REACH = 1e-3;
const WALL_LEAN = 0.5;

/**
 * The body and its raised slabs in paint, with the walls of bare wheel openings in trim: with no lip round them they face the camera from the
 * front and catch the light as a pale band.
 */
function painted_shell(shell: THREE.BufferGeometry[], d: Design, spec: CarSpec, paint: THREE.Color, trim: THREE.Color): THREE.BufferGeometry {
  const painted = tint(merge(shell), paint);
  if (d.arches.steps === 0 || d.arches.flare > 0) return painted;
  const position = painted.getAttribute("position");
  const colors = painted.getAttribute("color");
  const reach = spec.wheel.radius + d.arches.gap + WALL_REACH;
  const axles = axles_of(spec).map(({ z }) => z);
  const in_arch = (v: number) => axles.some((z) => Math.hypot(position.getZ(v) - z, position.getY(v) - spec.wheel.radius) < reach);
  const [a, b, c, normal] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < position.count; i += 3) {
    if (!in_arch(i) || !in_arch(i + 1) || !in_arch(i + 2)) continue;
    a.fromBufferAttribute(position, i);
    normal.subVectors(b.fromBufferAttribute(position, i + 1), a).cross(c.fromBufferAttribute(position, i + 2).sub(a)).normalize();
    if (Math.abs(normal.x) > WALL_LEAN) continue;
    for (let v = i; v < i + 3; v++) colors.setXYZ(v, trim.r, trim.g, trim.b);
  }
  return painted;
}

// Paint, trim, glass and decals are baked into vertex colours so the whole shell is one draw; a repaint rebuilds the view.
export function car_view(paint: THREE.Color, spec: CarSpec = COUPE, kit: Record<Slot, number> = DEFAULT_PARTS, livery: Livery | null = null, finish: Finish | null = null): CarView {
  const aero = aero_of(kit);
  const { d, detail } = fitted_design(spec, kit, paint, color(tones.trim));
  const root = new THREE.Group();
  root.renderOrder = CAR_ORDER;
  const body = new THREE.Group();
  body.position.y = -(rest_reach(spec) - spec.wheel.mounts[0][1]);
  const trim = color(tones.trim);
  const arch_tone = d.arches.tone === "paint" ? paint : trim;

  const glass = color(tones.glass);
  const stripped = kit.weight > 1;
  const nose = d.outline[0][0];
  const tail = d.outline[d.outline.length - 1][0];
  const tyre = part_of("tyres", kit.tyres).look?.tyre ?? (d.tread ? { ...STOCK_TYRE, tread: d.tread } : STOCK_TYRE);
  const fitted = fitted_tyres(d, spec, tyre);
  const shell_body = merge(body_pieces(d, spec).map((piece) => extrude(piece, d.width)));
  const cabin = merge(cabin_parts(d.cabin, paint, glass));
  const hull_base = merge(
    painted_shell([d.taper ? taper(shell_body, d.taper.from, tail, d.taper.share) : shell_body, ...body_slabs(d, spec)], d, spec, paint, trim),
    flares(d, spec).map((g) => tint(g, arch_tone)),
    wells(d, spec, Math.max(...fitted.map((look) => look.width))).map((g) => tint(g, trim)),
    // The sill strip runs between wheel openings: a body without them (a tub, pontoons, a cage) has no sill to trim.
    (d.arches.steps === 0 || kit_skirts(d, aero) ? [] : skirts(d, spec, 0.03, 0.09)).map((g) => tint(g, trim)),
    parts([...d.paint, ...(d.mirror?.paint ?? [])]).map((g) => tint(g, paint)),
    parts([...d.trim, ...(d.mirror?.trim ?? [])]).map((g) => tint(g, trim)),
    parts(livery && livery.decal !== "none" ? [] : (d.stripes ?? [])).map((g) => tint(g, trim)),
    parts(stripped ? [] : d.markers).map((g) => tint(g, color(brand.warning))),
    parts(stripped ? [] : d.chrome).map((g) => tint(g, chrome_tone())),
  );
  // Decals are laid on the body as drawn, cabin included, then sculpted with it; the cabin itself keeps its width.
  const base = merge(hull_base, cabin);
  const decals = livery && livery.decal !== "none" ? livery_parts(livery, side_panel(d, spec), roof(base, glass), back(base, paint), nose, tail) : [];
  const shell = merge(sculpt(merge(hull_base, rear_wing(d, aero, paint, trim), aero_parts(d, spec, aero, paint, trim, detail.swaps), kit_parts(d, kit, paint, trim, detail.swaps), detail.body, decals), d), cabin, on_glass(d.cabin, detail.glass));
  const matte = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const [painted, rest] = finish ? split_tone(shell, paint) : [null, shell];
  const hull = new THREE.Mesh(rest, matte);
  hull.castShadow = true;
  if (painted && finish) body.add(metal_hull(painted, finish));

  const { heads, tails, brake } = lamps(d);
  sculpt(heads.geometry, d);
  sculpt(tails.geometry, d);
  const pods = popup(d, heads, paint, trim, matte);
  const jet = { sway: { value: 0 }, flicker: { value: 0 } };
  const flame = nitro_flame(d, jet);
  body.add(hull, pods?.pivot ?? heads, tails, flame);
  root.add(body);

  const caliper = part_of("brakes", kit.brakes).look?.caliper ?? (d.caliper ? { ...STOCK_CALIPER, tone: d.caliper } : STOCK_CALIPER);
  const axles = axles_of(spec);
  const tyres = [0, 1].map((axle) => wheel_geometry(spec.wheel.radius, d.tyre[axle], d.rim, fitted[axle]));
  const brakes = [0, 1].map((axle) => brake_geometry(spec.wheel.radius, d.tyre[axle], d.rim, fitted[axle], caliper));
  const wheel_material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const wheel_axles = spec.wheel.mounts.map((_, i) => axle_index(axles, i));
  const wheels = wheel_axles.map((axle, i) => {
    const steer = new THREE.Group();
    steer.rotation.z = Math.sign(spec.wheel.mounts[i][0]) * detail.camber;
    const spin = new THREE.Group();
    const mesh = new THREE.Mesh(tyres[Math.min(axle, 1)], wheel_material);
    mesh.castShadow = true;
    spin.add(mesh);
    const brake_mesh = new THREE.Mesh(brakes[Math.min(axle, 1)], wheel_material);
    mesh.scale.x = brake_mesh.scale.x = Math.sign(spec.wheel.mounts[i][0]);
    steer.add(spin, brake_mesh);
    root.add(steer);
    return steer;
  });
  const steered = wheel_axles.map((axle) => axles[axle].steer);
  const arm_rest = rest_reach(spec);
  const arms = spec.wheel.mounts.map(([mx, , mz], i): ArmSwing | null => {
    const arm = d.arms?.[wheel_axles[i]];
    if (!arm) return null;
    const side = Math.sign(mx);
    const [px, py, pz] = arm.pivot;
    const geometry = merge(
      arm.trim.map((part) => tint(side_part(part, side), trim)),
      (stripped ? [] : arm.markers).map((part) => tint(side_part(part, side), color(brand.warning))),
    ).translate(-side * px, -py, -pz);
    const mesh = new THREE.Mesh(geometry, matte);
    mesh.castShadow = true;
    const group = new THREE.Group();
    group.position.set(side * px, py, pz);
    group.add(mesh);
    body.add(group);
    const dx = mx - side * px;
    const dz = mz - pz;
    const reach = Math.hypot(dx, dz);
    return { group, axis: new THREE.Vector3(-dz / reach, 0, dx / reach), reach, rest: arm_rest };
  });
  const view = { root, body, wheels, arms, steered, brake, heads, lights: true, popup: pods, eye: d.eye ? new THREE.Vector3(0, body.position.y + d.eye[1], d.eye[0]) : null, flame, jet, sway_at: 0 };
  snap_lights(view, true);
  return view;
}

export function sync_car_view(view: CarView, car: Car) {
  view.root.position.copy(car.pos);
  view.root.quaternion.copy(car.quat);
  car.wheels.forEach((w, i) => {
    const g = view.wheels[i];
    g.position.set(w.mount.x, w.mount.y - (w.reach - car.spec.wheel.radius), w.mount.z);
    g.rotation.y = -w.angle;
    g.children[0].rotation.x = w.spin;
    const arm = view.arms[i];
    if (arm) arm.group.quaternion.setFromAxisAngle(arm.axis, Math.asin(Math.max(-1, Math.min(1, (arm.rest - w.reach) / arm.reach))));
  });
  view.brake.emissiveIntensity = car.braking > 0.05 ? 2.2 : 0.5;
}

export function rest_wheels(view: CarView, spec: CarSpec = COUPE) {
  const drop = rest_reach(spec) - spec.wheel.radius;
  view.wheels.forEach((wheel, i) => {
    const [x, y, z] = spec.wheel.mounts[i];
    wheel.position.set(x, y - drop, z);
  });
  for (const arm of view.arms) arm?.group.quaternion.identity();
}

// Ghost and remote cars have no collision, so one can pass right through the camera and fill the view.
const CAMERA_HIDE = 2.5;
const CAMERA_CLEAR = 6;

/** Opacity factor for a see-through car centred at `at`: 0 within `CAMERA_HIDE` metres of the camera, 1 from `CAMERA_CLEAR` out. */
export function camera_fade(at: THREE.Vector3, camera: THREE.Vector3): number {
  const k = Math.max(0, Math.min(1, (at.distanceTo(camera) - CAMERA_HIDE) / (CAMERA_CLEAR - CAMERA_HIDE)));
  // Squared: a car a few metres off still fills most of the frame, so it stays faint until it is clear.
  return k * k;
}

export function dispose_car_view(view: CarView) {
  view.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    (object.material as THREE.Material).dispose();
  });
}
