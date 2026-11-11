import { describe, expect, test } from "bun:test";
import { BASE_FOV, SPEED_ZOOM, Tilt, speed_fov, zoom_share } from "./camera-feel";

const KMH = 1 / 3.6;
const DEG = Math.PI / 180;

describe("speed zoom", () => {
  test("off never widens or backs off", () => {
    for (const kmh of [0, 100, 250]) {
      expect(speed_fov(SPEED_ZOOM.off, kmh * KMH, true)).toBe(BASE_FOV);
      expect(SPEED_ZOOM.off.back * zoom_share(SPEED_ZOOM.off, kmh * KMH)).toBe(0);
    }
  });

  test("subtle stays within 8 degrees and eases in", () => {
    const fov = (kmh: number) => speed_fov(SPEED_ZOOM.subtle, kmh * KMH, false) - BASE_FOV;
    expect(fov(0)).toBe(0);
    expect(fov(100)).toBeLessThan(2.5);
    expect(fov(250)).toBeGreaterThan(6);
    expect(fov(400)).toBeLessThanOrEqual(8);
    expect(fov(50) / 50).toBeLessThan(fov(250) / 250);
    expect(SPEED_ZOOM.subtle.back * zoom_share(SPEED_ZOOM.subtle, 250 * KMH)).toBeLessThan(1);
  });

  test("strong keeps the old linear 0.3 degrees per m/s, capped at 24", () => {
    expect(speed_fov(SPEED_ZOOM.strong, 50, false)).toBeCloseTo(BASE_FOV + 15);
    expect(speed_fov(SPEED_ZOOM.strong, 120, false)).toBe(BASE_FOV + 24);
    expect(SPEED_ZOOM.strong.back * zoom_share(SPEED_ZOOM.strong, 50)).toBeCloseTo(50 * 0.022);
  });

  test("each step up widens more at speed", () => {
    const at = 250 * KMH;
    expect(speed_fov(SPEED_ZOOM.off, at, false)).toBeLessThan(speed_fov(SPEED_ZOOM.subtle, at, false));
    expect(speed_fov(SPEED_ZOOM.subtle, at, false)).toBeLessThan(speed_fov(SPEED_ZOOM.strong, at, false));
  });
});

describe("tilt", () => {
  const run = (tilt: Tilt, seconds: number, forward: (t: number) => number, on = true) => {
    const dt = 1 / 60;
    let max_step = 0;
    for (let i = 0; i < seconds * 60; i++) {
      const pitch = tilt.pitch;
      tilt.update(dt, forward(i * dt), on);
      max_step = Math.max(max_step, Math.abs(tilt.pitch - pitch));
    }
    return max_step;
  };

  test("braking dips, accelerating lifts, a corner never rolls the view", () => {
    const brake = new Tilt();
    run(brake, 2, () => -12);
    expect(brake.pitch).toBeLessThan(-0.5 * DEG);
    const launch = new Tilt();
    run(launch, 2, () => 5);
    expect(launch.pitch).toBeGreaterThan(0.3 * DEG);
    const right_turn = new Tilt();
    run(right_turn, 2, () => 0);
    expect(right_turn.pitch).toBe(0);
  });

  test("bounded under any acceleration, and a one-frame teleport spike barely moves it", () => {
    const tilt = new Tilt();
    run(tilt, 3, () => -1e4);
    expect(Math.abs(tilt.pitch)).toBeLessThanOrEqual(1.5 * DEG + 1e-12);
    const spike = new Tilt();
    spike.update(1 / 60, 1e5, true);
    expect(Math.abs(spike.pitch)).toBeLessThan(0.05 * DEG);
  });

  test("damped: a step settles without overshoot, and step-rhythm jitter is smoothed away", () => {
    const tilt = new Tilt();
    let peak = 0;
    for (let i = 0; i < 300; i++) {
      tilt.update(1 / 60, -9.81, true);
      peak = Math.min(peak, tilt.pitch);
    }
    expect(peak).toBeCloseTo(tilt.pitch, 6);
    const jitter = new Tilt();
    run(jitter, 2, () => -9.81);
    const settled = jitter.pitch;
    const max_step = run(jitter, 1, (t) => -9.81 * (Math.round(t * 60) % 2 ? 1.17 : 0.83));
    expect(max_step).toBeLessThan(0.02 * DEG);
    expect(Math.abs(jitter.pitch - settled)).toBeLessThan(0.05 * DEG);
  });

  test("off eases back level", () => {
    const tilt = new Tilt();
    run(tilt, 2, () => -9.81);
    run(tilt, 3, () => -9.81, false);
    expect(Math.abs(tilt.pitch)).toBeLessThan(0.01 * DEG);
  });
});
