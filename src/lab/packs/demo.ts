import { CARS } from "../../car/cars";
import type { Pack, Question } from "../pack";

const ASK: Question[] = [
  { kind: "scale", id: "grip", label: "Grip", low: "slides everywhere", high: "glued" },
  { kind: "scale", id: "pred", label: "Predictability", low: "snaps without warning", high: "always telegraphs" },
  { kind: "scale", id: "fun", label: "Fun", low: "a chore", high: "again!" },
  { kind: "text", id: "note", label: "Note" },
];

// The race-engine Sturm, then three turbo stages as lab-only mods: what docs/lab.md walks through for top-tier parts.
const STURM = "sturm.4.0.2.1.2";

const pack: Pack = {
  id: "demo",
  rev: 1,
  title: "Lab demo",
  brief: "Surfaces on the skidpad, the Sturm with three turbo stages, and a prototype on the slalom.",
  cars: {
    tsumuji: { name: "Tsumuji", spec: { ...CARS.kaze, name: "Tsumuji", mass: CARS.kaze.mass - 80 }, look: "kaze" },
  },
  trials: [
    { id: "hatch-asphalt-pad", car: "hatch.4.0.2.1.0", station: "skidpad", lane: "asphalt", goal: { kind: "laps", laps: 3 }, try: "hold the cone ring as fast as it goes", feel: "where the grip runs out" },
    { id: "hatch-sand-pad", car: "hatch.4.0.2.1.0", station: "skidpad", lane: "sand", goal: { kind: "laps", laps: 3 }, try: "the same ring on dune sand", feel: "how much later the slide comes and how it drags" },
    { id: "sturm-race", car: STURM, station: "runway", lane: "asphalt", goal: { kind: "run" }, try: "flat out from the line", feel: "the pull through the gears" },
    { id: "sturm-turbo1", car: STURM, mods: [{ scale: { torque: 1.15 }, add: { mass: 10 } }], station: "runway", lane: "asphalt", goal: { kind: "run" }, try: "flat out from the line", feel: "turbo stage 1 against the race engine" },
    { id: "sturm-turbo2", car: STURM, mods: [{ scale: { torque: 1.3 }, add: { mass: 18, redline: 300 } }], station: "runway", lane: "asphalt", goal: { kind: "run" }, try: "flat out from the line", feel: "turbo stage 2: still drivable off the line?" },
    { id: "sturm-turbo3", car: STURM, mods: [{ scale: { torque: 1.45 }, add: { mass: 25, redline: 500 } }], station: "oval", goal: { kind: "laps", laps: 1 }, try: "one lap of the oval", feel: "turbo stage 3 at top speed and into the corners" },
    { id: "tsumuji-slalom", car: "lab:tsumuji", station: "slalom", lane: "asphalt", goal: { kind: "run" }, try: "weave the 24 m cones", feel: "does the lighter car turn in quicker" },
    { id: "muscle-drift", car: "muscle.1.5.0.3.1.0.7.0.0.0.2", aids: { assist: false, stability: false }, station: "drift", goal: { kind: "time", seconds: 60 }, try: "hold a drift round the ring", feel: "how easy it is to start and hold", ask: [...ASK, { kind: "scale", id: "drift", label: "Drift ease", low: "won't slide or won't hold", high: "easy to start and hold" }] },
  ],
  ask: ASK,
};

export default pack;
