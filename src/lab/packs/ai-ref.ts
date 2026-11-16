import { NOTE } from "../ask";
import type { Pack } from "../pack";

// One pack a track: three laps of an island circuit fill most of the 20-minute session cap.
const COUPE = "coupe.4.0.0.1.0";
const LAPS = 3;

interface Ref {
  seed: number;
  route: "circuit" | "circuit-rev";
  map: string;
  feel: string;
}

const REFS: Record<string, Ref> = {
  "ai-ref-0": { seed: 0, route: "circuit", map: "1C0000000", feel: "the oracle's home track: the AI loses most in the two r17 hairpins and brakes up to 250 m early elsewhere" },
  "ai-ref-1": { seed: 1, route: "circuit", map: "1C0000001", feel: "the longest of the three, 5.8 km" },
  "ai-ref-2": { seed: 2, route: "circuit", map: "1C0000002", feel: "the shortest, 5.0 km" },
  "ai-ref-9-rev": { seed: 9, route: "circuit-rev", map: "1C0000009", feel: "a one-sided step on the line about 3/5 round, where the AI launches at 38 m/s: notice whether and how much you lift for it" },
  "ai-ref-16": { seed: 16, route: "circuit", map: "1C000000G", feel: "an object on the line about 9/10 round: notice where you go round it and how much you lift" },
  "ai-ref-30": { seed: 30, route: "circuit", map: "1C000000Y", feel: "lamp posts beside the line: notice how close you dare run to them" },
};

export const REF_IDS = Object.keys(REFS);

export function ref_pack(id: string): Pack {
  const ref = REFS[id];
  if (!ref) throw new Error(`no reference pack "${id}", expected one of ${REF_IDS.join(", ")}`);
  return {
    id,
    rev: 1,
    title: `Reference laps: seed ${ref.seed} ${ref.route}`,
    brief: `The stock coupe alone on island seed ${ref.seed}'s ${ref.route}, ${LAPS} laps from a standing start, no field. Your drive is traced and set against the AI's lap corner by corner.`,
    aim: "How fast does a person drive this track cleanly, and where?",
    trials: [
      {
        id: `s${ref.seed}-${ref.route}`,
        car: COUPE,
        map: ref.map,
        route: ref.route,
        goal: { kind: "laps", laps: LAPS },
        try: "race pace, clean: stay on the road and never reset; a spoiled lap, just keep driving",
        feel: ref.feel,
        question: "Your fastest clean lap: where you brake, how fast you carry through, where you lift",
      },
    ],
    ask: [NOTE],
  };
}
