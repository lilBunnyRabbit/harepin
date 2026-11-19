/// <reference types="bun" />
import "../../../scripts/fake-dom";
import { expect, test } from "bun:test";

test("the stand fits a car on its hull corners, not on every point of it", async () => {
  const THREE = await import("three");
  const { hull_corners } = await import("./car-stage");
  const box = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => new THREE.Vector3(x, y, z))));
  const inside = Array.from({ length: 200 }, (_, i) => new THREE.Vector3(Math.sin(i), Math.sin(2 * i), Math.sin(3 * i)).multiplyScalar(0.9));
  const corners = hull_corners([...inside, ...box]);
  expect(corners).toHaveLength(8);
  expect(new Set(corners)).toEqual(new Set(box));
});

test("corners found pile by pile are the corners of the whole cloud", async () => {
  const THREE = await import("three");
  const { hull_corners } = await import("./car-stage");
  const cloud = Array.from({ length: 900 }, (_, i) => new THREE.Vector3(Math.sin(i * 1.7), Math.sin(i * 2.3 + 1), Math.sin(i * 3.1 + 2)));
  const piled = hull_corners([...hull_corners(cloud.slice(0, 400)), ...cloud.slice(400)]);
  expect(new Set(piled)).toEqual(new Set(hull_corners(cloud)));
});

test("a stand stopped while its car links never puts it up nor warms the other cars behind the closed menu", async () => {
  const { DEFAULT_BUILD } = await import("../../car/build");
  const frames: FrameRequestCallback[] = [];
  let idles = 0;
  Object.assign(globalThis, {
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback),
    cancelAnimationFrame: () => {},
    requestIdleCallback: () => ++idles,
    cancelIdleCallback: () => {},
  });
  const make = document.createElement;
  document.createElement = ((tag: string) => {
    const element = make.call(document, tag) as unknown as { getContext: () => object };
    const ctx = element.getContext();
    element.getContext = () => ({ ...ctx, createRadialGradient: () => ({ addColorStop() {} }) });
    return element;
  }) as typeof document.createElement;
  const { CarStage } = await import("./car-stage");
  const canvas = { dataset: {}, addEventListener() {}, removeEventListener() {} } as unknown as HTMLCanvasElement;
  const stage = new CarStage(canvas);
  stage.show(DEFAULT_BUILD);
  for (let callback = frames.shift(); callback; callback = frames.shift()) {
    callback(0);
    if (!frames.length) stage.stop();
  }
  await Promise.resolve();
  await Promise.resolve();
  document.createElement = make;
  expect(idles).toBe(0);
});
