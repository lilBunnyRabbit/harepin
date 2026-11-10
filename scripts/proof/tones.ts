import { JITTER_LEVELS, TERRAIN_BASES, type MeshTones } from "../../src/worldgen/chunks";
import type { MapTones } from "../../src/worldgen/map";

// Fixed tones instead of the palette's, so digests and checks don't move with a theme or need a DOM.
// Each road tone is a tag: the world checks read the layer of every road triangle back from its red channel.
export const ASPHALT = 1;
export const LAYER = ["", "asphalt", "sidewalk", "centre line", "edge line"];

const lut = new Float32Array(TERRAIN_BASES * JITTER_LEVELS * 3);
for (let i = 0; i < lut.length; i++) lut[i] = (i % 97) / 97;

export const MESH_TONES: MeshTones = {
  terrain: lut,
  asphalt: [ASPHALT, 0, 0],
  water: [0.1, 0.3, 0.6],
  sidewalk: [2, 0, 0],
  line: [3, 0, 0],
  edge_line: [4, 0, 0],
  walls: [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
  ],
  roofs: [
    [0.7, 0.1, 0.2],
    [0.3, 0.8, 0.4],
  ],
  roof_flat: [0.5, 0.5, 0.1],
  landmark: { pale: [0.11, 0, 0], band: [0.12, 0, 0], cap: [0.13, 0, 0], stone: [0.14, 0, 0], stone_shade: [0.15, 0, 0], plant: [0.16, 0, 0], plant_shade: [0.17, 0, 0] },
  deck: { deck: [0.21, 0, 0], side: [0.22, 0, 0], rail: [0.23, 0, 0], joint: [0.24, 0, 0], pad: [0.25, 0, 0], chevron: [0.26, 0, 0] },
};

export const MAP_TONES: MapTones = { terrain: lut, water: [0.1, 0.3, 0.6], cloud: [0.9, 0.9, 0.95] };
