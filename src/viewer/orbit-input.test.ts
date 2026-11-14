import { expect, test } from "bun:test";
import { OrbitInput } from "./orbit-input";
import type { Cam } from "./view-state";

class FakeCanvas extends EventTarget {
  readonly clientHeight = 800;
  captured = new Set<number>();
  setPointerCapture(id: number) {
    this.captured.add(id);
  }
}

function pointer(type: string, id: number, x: number, y: number, at: number) {
  const fields = { pointerId: id, clientX: x, clientY: y, button: 0, shiftKey: false, timeStamp: at };
  return Object.defineProperties(new Event(type), Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value }])));
}

function rig() {
  const canvas = new FakeCanvas();
  let cam: Cam = { yaw: 30, pitch: 14, dist: 8, target: [0, 0.6, 0], fov: 30 };
  const log = { taps: 0, settles: 0 };
  const input = new OrbitInput(canvas as unknown as HTMLElement, {
    cam: () => cam,
    move: (next) => (cam = next),
    tap: () => log.taps++,
    settled: () => log.settles++,
  });
  input.start();
  return { canvas, log, yaw: () => cam.yaw, input };
}

test("a long held drag keeps turning the car every move", () => {
  const { canvas, log, yaw } = rig();
  canvas.dispatchEvent(pointer("pointerdown", 1, 100, 400, 0));
  let last = yaw();
  for (let i = 1; i <= 180; i++) {
    canvas.dispatchEvent(pointer("pointermove", 1, 100 + i * 4, 400, i * 16));
    expect(yaw()).toBeLessThan(last);
    last = yaw();
  }
  expect(yaw()).toBeCloseTo(30 - 180 * 4 * 0.4);
  canvas.dispatchEvent(pointer("lostpointercapture", 1, 820, 400, 3000));
  expect(log).toEqual({ taps: 0, settles: 1 });
});

test("a cancelled pointer ends the drag without a tap", () => {
  const { canvas, log, yaw } = rig();
  canvas.dispatchEvent(pointer("pointerdown", 1, 100, 400, 0));
  canvas.dispatchEvent(pointer("pointercancel", 1, 100, 400, 50));
  canvas.dispatchEvent(pointer("lostpointercapture", 1, 100, 400, 51));
  canvas.dispatchEvent(pointer("pointermove", 1, 300, 400, 80));
  expect(log).toEqual({ taps: 0, settles: 0 });
  expect(yaw()).toBe(30);
});
