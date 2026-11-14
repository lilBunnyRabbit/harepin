import { ASK, with_station_asks } from "../ask";
import type { Pack } from "../pack";
import { pad, SURFACES } from "./surfaces";

const pack: Pack = {
  id: "t1a-pads",
  rev: 1,
  title: "Surfaces: skidpads",
  brief: "The stock coupe on ten surfaces: two laps of each skidpad. Rate each against the one before.",
  trials: with_station_asks(SURFACES.map(pad)),
  ask: ASK,
};

export default pack;
