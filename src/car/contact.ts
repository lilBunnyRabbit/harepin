import type { Collider } from "../world/world";
import { cos, sin } from "../sim-math";

/** 1 + restitution, as the wall's `RESTITUTION`: lower, since two cars crumple into each other rather than one into a wall. */
const BOUNCE = 1.2;
/** Tangential impulse cap as a share of the normal one: rubbing doors slow both cars, a side-swipe turns the struck one. */
const RUB = 0.4;
/** Closing speed (m/s) past which a touch counts as a hit and settles the bodies' roll and pitch. */
const HIT = 1.5;
/** Share of roll and pitch rate a hit keeps: softer than a wall's 0.7, so a tap does not settle a car. */
const SETTLE = 0.85;
const EPS = 1e-9;

const near = { ax: 0, az: 0, bx: 0, bz: 0 };

function reach(circles: readonly number[], front: boolean): number {
  let out = circles[0];
  for (let i = 1; i < circles.length; i++) out = front ? Math.max(out, circles[i]) : Math.min(out, circles[i]);
  return out;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Closest points of segments p1-q1 and p2-q2 in the ground plane (Ericson, Real-Time Collision Detection 5.1.9).
function spines(p1x: number, p1z: number, d1x: number, d1z: number, p2x: number, p2z: number, d2x: number, d2z: number) {
  const rx = p1x - p2x;
  const rz = p1z - p2z;
  const a = d1x * d1x + d1z * d1z;
  const e = d2x * d2x + d2z * d2z;
  const f = d2x * rx + d2z * rz;
  let s = 0;
  let t = 0;
  if (a <= EPS && e <= EPS) {
    s = 0;
    t = 0;
  } else if (a <= EPS) {
    t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1z * rz;
    if (e <= EPS) s = clamp01(-c / a);
    else {
      const b = d1x * d2x + d1z * d2z;
      const denom = a * e - b * b;
      s = denom > EPS ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  near.ax = p1x + d1x * s;
  near.az = p1z + d1z * s;
  near.bx = p2x + d2x * t;
  near.bz = p2z + d2z * t;
}

/**
 * Car-to-car contact, run once per physics step after every car has stepped and hit the world. Each car is the capsule
 * its wall circles sweep (`spec.circles` along the heading, `spec.radius` round), so a car hit and a wall hit feel alike.
 * `impacts[i]` gets car i's hardest closing speed (m/s) this step, the number the wall pass returns: 0 touching but
 * already parting, -1 touching no car. The return is the count of touching pairs.
 */
export function collide_cars(field: readonly Collider[], impacts: Float64Array): number {
  for (let i = 0; i < field.length; i++) impacts[i] = -1;
  let touching = 0;
  for (let i = 0; i < field.length; i++)
    for (let j = i + 1; j < field.length; j++) {
      const hit = pair(field[i], field[j]);
      if (hit < 0) continue;
      touching++;
      impacts[i] = Math.max(impacts[i], hit);
      impacts[j] = Math.max(impacts[j], hit);
    }
  return touching;
}

function pair(a: Collider, b: Collider): number {
  const sa = a.spec;
  const sb = b.spec;
  const fa = reach(sa.circles, true);
  const ba = reach(sa.circles, false);
  const fb = reach(sb.circles, true);
  const bb = reach(sb.circles, false);
  const ra = sa.radius;
  const rb = sb.radius;
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  const span = Math.max(fa, -ba) + ra + Math.max(fb, -bb) + rb;
  if (dx * dx + dz * dz >= span * span) return -1;
  if (a.pos.y - sa.band[0] > b.pos.y + sb.band[1] || b.pos.y - sb.band[0] > a.pos.y + sa.band[1]) return -1;
  const ax = sin(a.heading);
  const az = cos(a.heading);
  const bx = sin(b.heading);
  const bz = cos(b.heading);
  spines(a.pos.x + ax * ba, a.pos.z + az * ba, ax * (fa - ba), az * (fa - ba), b.pos.x + bx * bb, b.pos.z + bz * bb, bx * (fb - bb), bz * (fb - bb));
  let nx = near.bx - near.ax;
  let nz = near.bz - near.az;
  const d = Math.sqrt(nx * nx + nz * nz);
  const depth = ra + rb - d;
  if (depth <= 0) return -1;
  if (d > 1e-6) {
    nx /= d;
    nz /= d;
  } else {
    // Spines crossing: push along the line between the centres, or sideways off a's heading if they coincide too.
    const c = Math.sqrt(dx * dx + dz * dz);
    nx = c > 1e-6 ? dx / c : az;
    nz = c > 1e-6 ? dz / c : -ax;
  }
  const ima = 1 / sa.mass;
  const imb = 1 / sb.mass;
  const iia = 1 / sa.inertia[1];
  const iib = 1 / sb.inertia[1];
  const share = depth / (ima + imb);
  a.pos.x -= nx * share * ima;
  a.pos.z -= nz * share * ima;
  b.pos.x += nx * share * imb;
  b.pos.z += nz * share * imb;
  const cx = (near.ax + nx * ra + near.bx - nx * rb) / 2 - nx * share * (ima - imb) / 2;
  const cz = (near.az + nz * ra + near.bz - nz * rb) / 2 - nz * share * (ima - imb) / 2;
  const rax = cx - a.pos.x;
  const raz = cz - a.pos.z;
  const rbx = cx - b.pos.x;
  const rbz = cz - b.pos.z;
  const arm_a = raz * nx - rax * nz;
  const arm_b = rbz * nx - rbx * nz;
  const vn = b.vel.x * nx + b.vel.z * nz + b.ang.y * arm_b - (a.vel.x * nx + a.vel.z * nz + a.ang.y * arm_a);
  if (vn >= 0) return 0;
  const j = (-vn * BOUNCE) / (ima + imb + arm_a * arm_a * iia + arm_b * arm_b * iib);
  push(a, b, nx, nz, j, arm_a, arm_b, ima, imb, iia, iib);
  const tx = -nz;
  const tz = nx;
  const tarm_a = raz * tx - rax * tz;
  const tarm_b = rbz * tx - rbx * tz;
  const vt = b.vel.x * tx + b.vel.z * tz + b.ang.y * tarm_b - (a.vel.x * tx + a.vel.z * tz + a.ang.y * tarm_a);
  const free = -vt / (ima + imb + tarm_a * tarm_a * iia + tarm_b * tarm_b * iib);
  const limit = RUB * j;
  push(a, b, tx, tz, Math.max(-limit, Math.min(limit, free)), tarm_a, tarm_b, ima, imb, iia, iib);
  if (-vn > HIT) {
    a.ang.x *= SETTLE;
    a.ang.z *= SETTLE;
    b.ang.x *= SETTLE;
    b.ang.z *= SETTLE;
  }
  return -vn;
}

function push(a: Collider, b: Collider, ux: number, uz: number, j: number, arm_a: number, arm_b: number, ima: number, imb: number, iia: number, iib: number) {
  a.vel.x -= ux * j * ima;
  a.vel.z -= uz * j * ima;
  a.ang.y -= arm_a * j * iia;
  b.vel.x += ux * j * imb;
  b.vel.z += uz * j * imb;
  b.ang.y += arm_b * j * iib;
}
