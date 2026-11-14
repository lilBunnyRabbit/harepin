import { LabSurface } from "../../worldgen/lab";
import { ASK, with_station_asks } from "../ask";
import type { Pack, Trial } from "../pack";

// The stock coupe, no parts fitted: one car on every surface, so the differences are the ground's.
const COUPE = "coupe.4.0.0.1.0";
const SURFACES = Object.values(LabSurface);
const LABEL: Record<LabSurface, string> = {
  asphalt: "asphalt",
  grass: "grass",
  sand: "dune sand",
  dirt: "dirt",
  hardpack: "hardpack",
  scree: "scree",
  wet: "wet asphalt",
  snow: "snow",
  packed_snow: "packed snow",
  ice: "ice",
  slush: "slush",
};
const BRAKE_FROM = 60;

const pad = (surface: LabSurface): Trial => ({
  id: `pad-${surface}`,
  car: COUPE,
  station: "skidpad",
  lane: surface,
  goal: { kind: "laps", laps: 2 },
  try: `hold the cone ring on ${LABEL[surface]} as fast as it goes`,
  feel: "where the grip runs out, how the slide arrives and whether it can be caught",
});

const brake = (surface: LabSurface): Trial => ({
  id: `brake-${surface}`,
  car: COUPE,
  station: "runway",
  lane: surface,
  goal: { kind: "stop", from_kmh: BRAKE_FROM },
  try: `past ${BRAKE_FROM} km/h down the ${LABEL[surface]} lane, then brake hard in a straight line`,
  feel: "how far it takes and whether it stays straight",
});

const pack: Pack = {
  id: "t1-surfaces",
  rev: 1,
  title: "Surfaces",
  brief: "The stock coupe on every surface: two laps of each skidpad, then a stop from 60 km/h on each runway lane. Rate each against the one before.",
  trials: with_station_asks([...SURFACES.map(pad), ...SURFACES.map(brake)]),
  ask: ASK,
};

export default pack;
