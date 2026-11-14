import { ASK, with_station_asks } from "../ask";
import type { Pack } from "../pack";
import { brake, BRAKE_FROM, SURFACES } from "./surfaces";

const pack: Pack = {
  id: "t1b-brakes",
  rev: 1,
  title: "Surfaces: braking",
  brief: `The stock coupe on ten surfaces: a stop from ${BRAKE_FROM} km/h on each runway lane. Rate each against the one before.`,
  trials: with_station_asks(SURFACES.map(brake)),
  ask: ASK,
};

export default pack;
