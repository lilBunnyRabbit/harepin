import type { Pack, Question } from "../pack";

const ASK: Question[] = [
  { kind: "scale", id: "grip", label: "Grip", low: "slides everywhere", high: "glued" },
  { kind: "scale", id: "pred", label: "Predictability", low: "snaps without warning", high: "always telegraphs" },
  { kind: "scale", id: "fun", label: "Fun", low: "a chore", high: "again!" },
  { kind: "text", id: "note", label: "Note" },
];

// The stock coupe, no parts fitted: every surface rated on the one car, so the differences are the ground's.
const COUPE = "coupe.4.0.0.1.0";

const pack: Pack = {
  id: "first-look",
  rev: 1,
  title: "First look",
  brief: "The stock coupe on asphalt, dirt, dune sand, ice and a kicker. Drive each, then rate grip, predictability and fun.",
  trials: [
    { id: "coupe-asphalt-pad", car: COUPE, station: "skidpad", lane: "asphalt", goal: { kind: "laps", laps: 3 }, try: "hold the cone ring as fast as it goes", feel: "where the grip runs out and how it lets go" },
    { id: "coupe-dirt-slalom", car: COUPE, station: "slalom", lane: "dirt", goal: { kind: "run" }, try: "weave the cones on dirt", feel: "how the car turns in and settles between cones" },
    { id: "coupe-sand-run", car: COUPE, station: "runway", lane: "sand", goal: { kind: "run" }, try: "flat out down the sand lane, a few weaves on the way", feel: "how much the sand drags and steers" },
    { id: "coupe-ice-pad", car: COUPE, station: "skidpad", lane: "ice", goal: { kind: "laps", laps: 2 }, try: "hold the ring on ice", feel: "whether a slide can be caught" },
    { id: "coupe-kicker-drop", car: COUPE, station: "kicker", lane: "drop", goal: { kind: "run" }, try: "hit the kicker and land on its falling back", feel: "how the car lands: planted or bouncing" },
  ],
  ask: ASK,
};

export default pack;
