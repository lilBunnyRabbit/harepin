/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";

test("skid marks draw with the contact patch, before the cars, in the opaque pass, so a tyre always covers them", async () => {
  const { Skids } = await import("./effects");
  const { CAR_ORDER, DECAL_ORDER } = await import("../car/contact-shadow");
  const { mesh } = new Skids();
  const material = mesh.material as import("three").Material;
  expect(DECAL_ORDER).toBeLessThan(CAR_ORDER);
  expect(mesh.renderOrder).toBe(DECAL_ORDER);
  expect([material.transparent, material.depthWrite]).toEqual([false, false]);
});
