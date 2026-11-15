import { Quaternion, Vector3 } from "three";
import type { Car, Ground, StepFrame, Wheel } from "./car";
import type { CarSpec } from "./cars";
import { USEFUL_SLIP } from "./steering";

/**
 * Default `CarSpec.drift_rear_bite`. Share of the gap between sliding and peak side grip a held drift's rears keep past their peak, with the steering assist
 * off and `Car.drift_full_lock`. At sliding grip, with the fronts biting, lifting to 0.3 gas left a 90 km/h drift at 35
 * degrees rather than bringing it in (17 at 0.8), and a 20 degree drift weaved.
 */
const DRIFT_REAR_BITE = 0.8;
// The slip model is viscous below its 2 m/s floor, so a locked wheel still creeps under any steady force (a slope);
// a pinned contact patch with a load-scaled spring and damper gives it real static friction.
const STICK_SPEED = 0.2;
const STICK_SPRING = 25;
const STICK_DAMPER = 2.2;
// Bearing drag on a wheel in the air, per second. It was 0.1% a step, 30% a second at 360 Hz, so after a long jump every
// wheel landed turning half the car's speed: past peak slip, with little lateral grip left.
const AIR_SPIN_DRAG = 0.02;

// Normalised magic formula: peak at s = 1, sliding grip sin(C·π/2) ≈ 65% of peak.
const MF_C = 1.55;
const MF_B = Math.tan(Math.PI / (2 * MF_C));
// Its tail kept falling to that 65%, so a car thrown fully sideways glided; real tyres slide at 70-80% of peak, so past
// SLIDE_S the patch slides outright at SLIDE_GRIP.
const SLIDE_GRIP = 0.76;
const SLIDE_S = Math.tan((Math.PI - Math.asin(SLIDE_GRIP)) / MF_C) / MF_B;
// Loose ground: the share of its peak a road tyre (`offroad` 0) keeps sliding on fully loose ground. Gravel and grass
// roll under the tread rather than tearing it, so a slide keeps most of the grip and stays catchable.
const LOOSE_SLIDE = 0.86;
/** Sliding share `offroad` 1 adds on loose ground: knobbly tread digs in; slicks (below 0) lose it. */
const LOOSE_BITE = 0.09;

// Module scratch rather than a returned object: the step runs at 360 Hz per wheel and must not allocate.
let curve_c = MF_C;
let curve_b = MF_B;
let curve_s = SLIDE_S;
let curve_spread = 1;
let curve_cap = 1;
/** Where the bounded curve peaks, in `s`: under 1 once the stock tyre's asphalt curve cuts the loose one off before its own peak. */
let curve_peak = 1;

// `share` (from `surface_grip`) and `road` (the stock tyres' `mu` over this tyre's) bound the loose curve by
// the stock tyre's asphalt curve at the same slip. Unbound, wider and slower to fall past the peak, it kept more of a
// high-share tyre's grip in a slide than asphalt does, and locked stops and launches off the road beat the road.
function shape(loose: number, offroad: number, share: number, road: number) {
  if (loose <= 0) {
    curve_c = MF_C;
    curve_b = MF_B;
    curve_s = SLIDE_S;
    curve_spread = 1;
    curve_peak = 1;
    return;
  }
  curve_cap = road / share;
  const slide = LOOSE_SLIDE + LOOSE_BITE * Math.max(-1, Math.min(1, offroad));
  // With this C the magic formula falls from its peak towards `slide` and never under it.
  const c = (2 * (Math.PI - Math.asin(slide))) / Math.PI;
  // The peak moves out to keep asphalt's cornering stiffness: softer, a 120 km/h keyboard lane change on dirt took a
  // second longer to settle; stiffer, the peak sat at asphalt's slip and nothing felt broader.
  const spread = (c * Math.tan(Math.PI / (2 * c))) / (MF_C * MF_B);
  curve_c = MF_C + (c - MF_C) * loose;
  curve_b = Math.tan(Math.PI / (2 * curve_c));
  const floor = SLIDE_GRIP + (slide - SLIDE_GRIP) * loose;
  curve_s = floor > Math.sin((curve_c * Math.PI) / 2) + 1e-6 ? Math.tan((Math.PI - Math.asin(floor)) / curve_c) / curve_b : Infinity;
  curve_spread = 1 + (spread - 1) * loose;
  curve_peak = bound_peak();
}

// The loose curve rises to its peak at s = 1 while the bound, past its own peak at 1 / spread, falls: the bounded
// curve peaks where they cross, or on the bound's peak when the loose curve is already over it there.
function bound_peak(): number {
  if (bound_at(1) >= 1) return 1;
  let lo = 1 / curve_spread;
  if (loose_at(lo) >= bound_at(lo)) return lo;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (loose_at(mid) < bound_at(mid)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function bound_at(s: number): number {
  return curve_cap * Math.sin(MF_C * Math.atan(MF_B * s * curve_spread));
}

function loose_at(s: number): number {
  return Math.sin(curve_c * Math.atan(curve_b * s));
}

/**
 * Share of `spec.mu` a tyre grips with on ground of row grip `surface`, `dirt` on a trail. The loss `offroad` shrugs off
 * is capped at asphalt's, and the tyre's own loose-ground bite (`grip_dirt`, `grip_grass`) goes on top: capped
 * together, an off-road tyre's tarmac penalty followed it onto the dirt and the rally car's stock tyres outgripped its
 * rally tyres there. The parts keep bite × their `mu` scale at or under 1, so loose ground never outgrips road tyres on the road.
 */
export function surface_grip(spec: CarSpec, surface: number, dirt: boolean): number {
  const bite = surface < 1 ? ((dirt ? spec.grip_dirt : spec.grip_grass) ?? 1) : 1;
  return Math.max(0, Math.min(1, surface + (1 - surface) * spec.offroad)) * bite;
}

function magic(s: number): number {
  const y = Math.sin(curve_c * Math.atan(curve_b * Math.max(-curve_s, Math.min(curve_s, s))));
  if (curve_spread === 1) return y;
  const road = s * curve_spread;
  return Math.min(y, curve_cap * Math.sin(MF_C * Math.atan(MF_B * Math.max(-SLIDE_S, Math.min(SLIDE_S, road)))));
}

function combined_x(sx: number, sy: number): number {
  const s = Math.hypot(sx, sy);
  return s < 1e-6 ? curve_c * curve_b * sx : (magic(s) * sx) / s;
}

function combined_y(sx: number, sy: number): number {
  const s = Math.hypot(sx, sy);
  return s < 1e-6 ? curve_c * curve_b * sy : (magic(s) * sy) / s;
}

const wheel_fwd = new Vector3();
const lat = new Vector3();
const lever = new Vector3();
const point_vel = new Vector3();
const force = new Vector3();
const tmp = new Vector3();
const steer_q = new Quaternion();
const Y = new Vector3(0, 1, 0);

export function spin_free(car: Car, frame: StepFrame, w: Wheel, dt: number, torque: number, brake_torque: number, inertia: number) {
  const vf = frame.vf;
  let omega = w.omega + (dt * torque) / inertia;
  const cut = (dt * brake_torque) / inertia;
  omega -= Math.sign(omega) * Math.min(Math.abs(omega), cut);
  w.omega = omega * (1 - AIR_SPIN_DRAG * dt);
  w.spin += w.omega * dt;
  // Wheel speed against the car's, as on the ground, so traction control still sees a wheel revving free in the
  // air; unchecked it lands spinning far past peak slip with no lateral grip left.
  w.slip = (w.omega * car.spec.wheel.radius - vf) / Math.max(Math.abs(vf), 2);
  w.abs = false;
  w.abs_factor = 1;
  w.anchored = false;
}

/** Pushes the body up off a wheel's spring, damper, anti-roll bar and bump stop; returns the wheel's load. */
export function suspend(car: Car, frame: StepFrame, w: Wheel, dt: number, ground: Ground): number {
  const { spec, body } = car;
  const rest = spec.wheel.rest;
  const other = car.wheels[w.pair];
  let suspension = spec.spring * w.compression + (spec.damper * (w.compression - w.prev)) / dt;
  suspension += w.axle.arb * (w.compression - other.compression);
  if (w.compression > rest) suspension += spec.bump * (w.compression - rest);
  suspension = Math.max(0, Math.min(spec.strut_max, suspension));
  lever.copy(w.point).sub(body.pos);
  ground.normal(w.point.x, w.point.z, w.normal, w.point.y);
  const load = suspension * Math.max(0, frame.up.dot(w.normal));
  w.load = load;
  // Along body up, a pitched body pushed itself sideways and a car in neutral rolled off on the flat.
  body.apply(force.copy(w.normal).multiplyScalar(load), w.point);
  return load;
}

/** A wheel on the ground: its spin against the tyre's grip, ABS, the static anchor and the tyre's force on the body. */
export function tyre(car: Car, frame: StepFrame, w: Wheel, dt: number, ground: Ground, torque: number, brake_torque: number, inertia: number, load: number) {
  const { spec, body } = car;
  const hold_side = car.steering.hold_side;
  const { brake, drift_bite } = frame;
  const radius = spec.wheel.radius;
  const axle = w.axle;
  const cap = axle.steer ? Infinity : frame.side_cap;
  point_vel.crossVectors(body.ang, lever).add(body.vel);
  let tyre_angle = w.angle;
  if (drift_bite > 0 && axle.steer && hold_side !== 0) {
    // Held into the turn past its useful slip, a front bites as at that slip: the wheel shows full lock, the tyre
    // does not scrub. At full lock it sat 50-60 degrees past its course and the drift ran wide.
    tmp.copy(point_vel).applyQuaternion(frame.inv);
    const useful = Math.atan2(-tmp.x, tmp.z) + hold_side * (spec.drift_reach ?? USEFUL_SLIP) * spec.peak_angle;
    if (hold_side * w.angle > hold_side * useful) tyre_angle = w.angle + (useful - w.angle) * drift_bite;
  }
  steer_q.setFromAxisAngle(Y, -tyre_angle);
  wheel_fwd.set(0, 0, 1).applyQuaternion(steer_q).applyQuaternion(body.quat);
  wheel_fwd.addScaledVector(w.normal, -wheel_fwd.dot(w.normal)).normalize();
  lat.crossVectors(w.normal, wheel_fwd).normalize();

  const v_long = point_vel.dot(wheel_fwd);
  const v_lat = point_vel.dot(lat);
  const denom = Math.max(Math.abs(v_long), 2);
  const surface = ground.grip(w.point.x, w.point.z);
  const grip = surface_grip(spec, surface, surface < 1 && !!ground.dirt?.(w.point.x, w.point.z));
  shape(ground.loose?.(w.point.x, w.point.z) ?? 0, spec.offroad, grip, frame.stock);
  // Tyre force grows ever slower with load and tops out at half `load_fade`; past that it stays flat. Left as a
  // parabola it fell to nothing at `load_fade` and reversed above it, which a hard landing reaches.
  const bite = Math.min(load, spec.load_fade / 2);
  const peak = spec.mu * axle.grip * grip * bite * (1 - bite / spec.load_fade);
  // Over the same denominator as the longitudinal slip, so the combined force points against the patch's slip
  // velocity. As an angle it stopped at 90 degrees while wheelspin over a 2 m/s floor did not: a rear spinning fully
  // sideways put nearly all its grip into drive and the car glided on the fronts.
  const sy = -v_lat / denom / Math.tan(spec.peak_angle) / curve_spread;
  const peak_slip = spec.peak_slip * curve_spread;
  w.peak = curve_spread * curve_peak;

  // Semi-implicit wheel spin: linearise the tyre's longitudinal force around the current slip so a stiff tyre
  // can't overshoot within one step; past the peak the slope clamps to 0 and wheelspin runs free.
  const sx0 = (w.omega * radius - v_long) / denom / peak_slip;
  const peak_x = brake > 0.05 && sx0 * v_long < 0 ? peak * spec.brake_grip : peak;
  const fx0 = combined_x(sx0, sy) * peak_x;
  const k = Math.max(0, ((combined_x(sx0 + 1e-3, sy) * peak_x - fx0) / 1e-3) * (radius / (denom * peak_slip)));
  const stiff = 1 + (dt * radius * k) / inertia;
  let omega = (w.omega + (dt / inertia) * (torque - radius * fx0 + radius * k * w.omega)) / stiff;
  const cut = (dt * brake_torque) / inertia / stiff;
  omega -= Math.sign(omega) * Math.min(Math.abs(omega), cut);
  w.omega = omega;
  w.spin += omega * dt;

  const sx = (omega * radius - v_long) / denom / peak_slip;
  const roll = ground.roll(w.point.x, w.point.z);
  const rolling = v_long * spec.roll_resist;
  const fx = combined_x(sx, sy) * peak_x - rolling;
  const side_sx = Math.max(-cap, Math.min(cap, sx));
  let fy = combined_y(side_sx, sy) * peak;
  const sliding = Math.hypot(side_sx, sy);
  if (drift_bite > 0 && !axle.steer && sliding > 1) fy += ((sy / sliding) * peak - fy) * (spec.drift_rear_bite ?? DRIFT_REAR_BITE) * drift_bite;
  w.slip = sx * peak_slip;
  const locking = car.abs && brake > 0.1 && w.slip < -car.abs_slip * w.peak && Math.abs(v_long) > 2;
  w.abs_factor = locking ? Math.max(0.2, w.abs_factor - 25 * dt) : Math.min(1, w.abs_factor + 12 * dt);
  w.abs = w.abs_factor < 0.95;
  w.lateral = Math.abs(sy);

  force.copy(wheel_fwd).multiplyScalar(fx).addScaledVector(lat, fy);
  const held = brake_torque > 0 && omega === 0;
  if (!held) w.anchored = false;
  else if (!w.anchored && Math.hypot(v_long, v_lat) < STICK_SPEED) {
    w.anchored = true;
    w.anchor.copy(w.point);
  }
  if (w.anchored) {
    tmp.copy(w.point).sub(w.anchor);
    tmp.addScaledVector(w.normal, -tmp.dot(w.normal)).multiplyScalar(-STICK_SPRING * load);
    tmp.addScaledVector(wheel_fwd, -v_long * STICK_DAMPER * load).addScaledVector(lat, -v_lat * STICK_DAMPER * load);
    if (tmp.length() > peak) w.anchored = false;
    else force.copy(tmp);
  }
  body.apply(force, w.point);
  // Grass drag acts at the centre of mass: at the contact patch it pitched load off the rear, and at full throttle on grass
  // the unloaded rear lost straight-line yaw stability, so the car circled while TCS cut the power.
  body.force.addScaledVector(wheel_fwd, -rolling * (roll - 1) * (1 - spec.offroad));
}
