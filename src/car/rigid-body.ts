import { Quaternion, Vector3 } from "three";
import type { Triple } from "./cars";

const lever = new Vector3();
const moment = new Vector3();
const inv = new Quaternion();

export class RigidBody {
  readonly pos = new Vector3();
  readonly quat = new Quaternion();
  readonly vel = new Vector3();
  /** World-space angular velocity, rad/s. */
  readonly ang = new Vector3();
  /** World-space force and torque gathered for the next `integrate`, which clears them. */
  readonly force = new Vector3();
  readonly torque = new Vector3();

  constructor(
    readonly mass: number,
    /** Principal moments about the body's own x, y, z axes. */
    readonly inertia: Triple,
  ) {}

  apply(force: Vector3, at: Vector3) {
    this.force.add(force);
    this.torque.add(moment.crossVectors(lever.copy(at).sub(this.pos), force));
  }

  integrate(dt: number) {
    const { pos, quat, vel, ang, inertia } = this;
    vel.addScaledVector(this.force, dt / this.mass);
    const local = this.torque.applyQuaternion(inv.copy(quat).invert());
    local.set(local.x / inertia[0], local.y / inertia[1], local.z / inertia[2]).applyQuaternion(quat);
    ang.addScaledVector(local, dt);
    pos.addScaledVector(vel, dt);

    const half = dt / 2;
    const { x, y, z, w } = quat;
    quat.set(
      x + half * (ang.x * w + ang.y * z - ang.z * y),
      y + half * (ang.y * w + ang.z * x - ang.x * z),
      z + half * (ang.z * w + ang.x * y - ang.y * x),
      w - half * (ang.x * x + ang.y * y + ang.z * z),
    );
    quat.normalize();
    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
  }
}
