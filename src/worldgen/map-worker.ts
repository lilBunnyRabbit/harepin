import { generate_world } from "./index";
import { map_data, map_transfers, type MapTones } from "./map";
import type { WorldKind } from "./types";

export interface MapRequest {
  seed: number;
  kind: WorldKind;
  tones: MapTones;
}

addEventListener("message", (event: MessageEvent<MapRequest>) => {
  const { seed, kind, tones } = event.data;
  const map = map_data(generate_world(seed, kind), tones);
  postMessage(map, { transfer: map_transfers(map) });
});
