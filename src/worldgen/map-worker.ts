import { generate } from "./index";
import { map_data, map_transfers, type MapTones } from "./map";

export interface MapRequest {
  seed: number;
  tones: MapTones;
}

addEventListener("message", (event: MessageEvent<MapRequest>) => {
  const { seed, tones } = event.data;
  const map = map_data(generate(seed), tones);
  postMessage(map, { transfer: map_transfers(map) });
});
