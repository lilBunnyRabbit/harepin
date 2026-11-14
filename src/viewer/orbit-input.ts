import { DIST_MAX, DIST_MIN, PITCH_MAX, PITCH_MIN, type Cam } from "./view-state";

const TURN_PER_PX = 0.4;
const TILT_PER_PX = 0.3;
const WHEEL_ZOOM = 0.0015;
const TAP_PX = 6;
const TAP_MS = 450;
const PAD_DEAD = 0.15;
const PAD_TURN = 120;
const PAD_ZOOM = 1.2;
const DEG = Math.PI / 180;

export interface OrbitHooks {
  cam(): Cam;
  move(cam: Cam): void;
  tap(x: number, y: number): void;
  /** Fired once a drag, pinch or wheel ends: the moment the view settles enough to print in the URL. */
  settled(): void;
}

export const PadButton = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5 } as const;

interface Down {
  x: number;
  y: number;
  start_x: number;
  start_y: number;
  at: number;
  button: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Orbit, pinch, pan and pad on one element; the camera state lives with the owner, this only proposes the next one. */
export class OrbitInput {
  private readonly down = new Map<number, Down>();
  private moved = false;
  private wheel_timer = 0;
  private pad_was: boolean[] = [];
  private pad_moving = false;

  constructor(
    private readonly element: HTMLElement,
    private readonly hooks: OrbitHooks,
  ) {}

  start() {
    this.element.addEventListener("pointerdown", this.on_down);
    this.element.addEventListener("pointermove", this.on_move);
    this.element.addEventListener("lostpointercapture", this.on_up);
    this.element.addEventListener("wheel", this.on_wheel, { passive: false });
    this.element.addEventListener("contextmenu", this.on_menu);
  }

  stop() {
    this.element.removeEventListener("pointerdown", this.on_down);
    this.element.removeEventListener("pointermove", this.on_move);
    this.element.removeEventListener("lostpointercapture", this.on_up);
    this.element.removeEventListener("wheel", this.on_wheel);
    this.element.removeEventListener("contextmenu", this.on_menu);
    clearTimeout(this.wheel_timer);
  }

  private readonly on_menu = (event: Event) => event.preventDefault();

  private readonly on_down = (event: PointerEvent) => {
    this.element.setPointerCapture(event.pointerId);
    this.down.set(event.pointerId, { x: event.clientX, y: event.clientY, start_x: event.clientX, start_y: event.clientY, at: event.timeStamp, button: event.button });
    if (this.down.size > 1) this.moved = true;
  };

  private readonly on_move = (event: PointerEvent) => {
    const p = this.down.get(event.pointerId);
    if (!p) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    if (Math.hypot(event.clientX - p.start_x, event.clientY - p.start_y) > TAP_PX) this.moved = true;
    const cam = this.hooks.cam();
    if (this.down.size >= 2) {
      const [a, b] = [...this.down.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = event.clientX;
      p.y = event.clientY;
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      const zoomed = before > 0 && after > 0 ? { ...cam, dist: clamp((cam.dist * before) / after, DIST_MIN, DIST_MAX) } : cam;
      this.hooks.move(this.panned(zoomed, dx / 2, dy / 2));
      return;
    }
    p.x = event.clientX;
    p.y = event.clientY;
    if (p.button === 2 || p.button === 1 || event.shiftKey) this.hooks.move(this.panned(cam, dx, dy));
    else this.hooks.move({ ...cam, yaw: cam.yaw - dx * TURN_PER_PX, pitch: clamp(cam.pitch + dy * TILT_PER_PX, PITCH_MIN, PITCH_MAX) });
  };

  private readonly on_up = (event: PointerEvent) => {
    const p = this.down.get(event.pointerId);
    this.down.delete(event.pointerId);
    if (!p) return;
    if (!this.moved && this.down.size === 0 && event.timeStamp - p.at < TAP_MS) this.hooks.tap(event.clientX, event.clientY);
    if (this.down.size === 0) {
      if (this.moved) this.hooks.settled();
      this.moved = false;
    }
  };

  private readonly on_wheel = (event: WheelEvent) => {
    event.preventDefault();
    const cam = this.hooks.cam();
    this.hooks.move({ ...cam, dist: clamp(cam.dist * Math.exp(event.deltaY * WHEEL_ZOOM), DIST_MIN, DIST_MAX) });
    clearTimeout(this.wheel_timer);
    this.wheel_timer = window.setTimeout(() => this.hooks.settled(), 250);
  };

  // Screen pixels to metres at the target's depth, along the camera's own right and up.
  private panned(cam: Cam, dx: number, dy: number): Cam {
    const height = this.element.clientHeight || 1;
    const per_px = (2 * cam.dist * Math.tan((cam.fov * DEG) / 2)) / height;
    const yaw = cam.yaw * DEG;
    const pitch = cam.pitch * DEG;
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const up = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch)];
    const [tx, ty, tz] = cam.target;
    return {
      ...cam,
      target: [tx - (right[0] * dx - up[0] * dy) * per_px, Math.max(0, ty + up[1] * dy * per_px), tz - (right[2] * dx - up[2] * dy) * per_px],
    };
  }

  /** Left stick orbits, right stick zooms; returns the buttons pressed since the last poll. */
  pad(dt: number): number[] {
    const pad = navigator.getGamepads().find((p) => p !== null);
    if (!pad) return [];
    const dead = (v: number) => (Math.abs(v) < PAD_DEAD ? 0 : v);
    const [lx, ly, , ry] = [dead(pad.axes[0] ?? 0), dead(pad.axes[1] ?? 0), 0, dead(pad.axes[3] ?? 0)];
    if (lx || ly || ry) {
      const cam = this.hooks.cam();
      this.hooks.move({
        ...cam,
        yaw: cam.yaw - lx * PAD_TURN * dt,
        pitch: clamp(cam.pitch - ly * PAD_TURN * 0.6 * dt, PITCH_MIN, PITCH_MAX),
        dist: clamp(cam.dist * Math.exp(ry * PAD_ZOOM * dt), DIST_MIN, DIST_MAX),
      });
      this.pad_moving = true;
    } else if (this.pad_moving) {
      this.pad_moving = false;
      this.hooks.settled();
    }
    const pressed: number[] = [];
    pad.buttons.forEach((button, i) => {
      if (button.pressed && !this.pad_was[i]) pressed.push(i);
      this.pad_was[i] = button.pressed;
    });
    return pressed;
  }
}
