import { expect, test } from "bun:test";
import { PITCH_MAX, PITCH_MIN, ZOOM_MAX, drag_pose, is_double_tap, is_tap, pinch_factor, wheel_factor, zoom_pose, type Pose } from "./stage-gestures";

const rest = (): Pose => ({ yaw: 0.4, pitch: 0, zoom: 1 });

test("a drag across spins the car with no limit and leaves the tilt alone", () => {
  const pose = rest();
  drag_pose(pose, 200, 0);
  expect(pose.yaw).toBeGreaterThan(0.4 + 1);
  expect(pose.pitch).toBe(0);
  drag_pose(pose, -5000, 0);
  expect(pose.yaw).toBeLessThan(-40);
});

test("a drag down or up tilts the view and stops at its limits", () => {
  const pose = rest();
  drag_pose(pose, 0, 20);
  expect(pose.pitch).toBeGreaterThan(0);
  expect(pose.pitch).toBeLessThan(PITCH_MAX);
  expect(pose.yaw).toBe(0.4);
  drag_pose(pose, 0, 4000);
  expect(pose.pitch).toBe(PITCH_MAX);
  drag_pose(pose, 0, -8000);
  expect(pose.pitch).toBe(PITCH_MIN);
});

test("the wheel and a pinch zoom between the whole-car fit and the closest view", () => {
  const pose = rest();
  zoom_pose(pose, wheel_factor(-100));
  expect(pose.zoom).toBeGreaterThan(1);
  expect(pose.zoom).toBeLessThan(ZOOM_MAX);
  zoom_pose(pose, wheel_factor(-100_000));
  expect(pose.zoom).toBe(ZOOM_MAX);
  zoom_pose(pose, wheel_factor(100_000));
  expect(pose.zoom).toBe(1);
  zoom_pose(pose, pinch_factor(100, 150));
  expect(pose.zoom).toBeCloseTo(1.5);
  zoom_pose(pose, pinch_factor(0, 150));
  expect(pose.zoom).toBeCloseTo(1.5);
  zoom_pose(pose, pinch_factor(300, 30));
  expect(pose.zoom).toBe(1);
});

test("a short still press is a tap; a long one, or one that travelled, is not", () => {
  expect(is_tap({ x: 0, y: 0, at: 1000, travel: 3 }, 1120)).toBe(true);
  expect(is_tap({ x: 0, y: 0, at: 1000, travel: 3 }, 1600)).toBe(false);
  expect(is_tap({ x: 0, y: 0, at: 1000, travel: 60 }, 1120)).toBe(false);
});

test("two taps close in time and place are a double tap", () => {
  const first = { x: 300, y: 200, at: 1000 };
  expect(is_double_tap(null, first)).toBe(false);
  expect(is_double_tap(first, { x: 310, y: 195, at: 1250 })).toBe(true);
  expect(is_double_tap(first, { x: 310, y: 195, at: 1700 })).toBe(false);
  expect(is_double_tap(first, { x: 500, y: 200, at: 1250 })).toBe(false);
});
