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

test("a skid mark blends its colour only: custom blending on alpha too left the frame see-through, and the page showed in every mark", async () => {
  const { Skids } = await import("./effects");
  const { ZeroFactor, OneFactor } = await import("three");
  const material = new Skids().mesh.material as import("three").Material;
  expect([material.blendSrcAlpha, material.blendDstAlpha]).toEqual([ZeroFactor, OneFactor]);
});

test("puffs draw after the cars and the water, so spray shows on the surface it is thrown from", async () => {
  const { Smoke } = await import("./effects");
  const { CAR_ORDER } = await import("../car/contact-shadow");
  expect(new Smoke("grass").mesh.renderOrder).toBeGreaterThan(CAR_ORDER);
});

test("puffs are unlit, so a puff keeps its tint at dusk instead of going near black", async () => {
  const { Smoke } = await import("./effects");
  const material = new Smoke("dust").mesh.material as import("three").Material;
  expect([material.type, material.transparent, material.depthWrite]).toEqual(["MeshBasicMaterial", true, false]);
});
