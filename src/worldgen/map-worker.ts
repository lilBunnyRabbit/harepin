import { generate_world } from "./kinds/kinds";
import { map_data, map_transfers, type MapTones } from "./map";
import type { WorldKind } from "./types";

export interface MapRequest {
  seed: number;
  kind: WorldKind;
  levels: readonly number[];
  tones: MapTones;
}

addEventListener("message", (event: MessageEvent<MapRequest>) => {
  const { seed, kind, levels, tones } = event.data;
  const map = map_data(generate_world(seed, kind, levels), tones);
  postMessage(map, { transfer: map_transfers(map) });
});
