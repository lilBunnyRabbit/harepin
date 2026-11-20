import { DEFAULT_PARTS, SLOTS, SLOT_NAMES, build_code, parse_build, part_of, type Build } from "../car/build";
import { CARS } from "../car/cars";
import { rating, type Rating } from "../car/pi";
import { car_facts, type CarFacts } from "../menu/car-facts";

/** Cards one chat message may carry: a message is 140 characters, so more would be a wall. */
export const MAX_CARDS = 2;
export const BUILD_PARAM = "car";

const TRAIL = /[)\]}>.,!?;:'"]+$/;
const LEAD = /^[(<[{'"]+/;

export interface BuildSummary {
  code: string;
  car: string;
  rating: Rating;
  facts: CarFacts;
  parts: string[];
}

function build_of(word: string): Build | null {
  const trimmed = word.replace(LEAD, "").replace(TRAIL, "");
  const plain = parse_build(trimmed);
  if (plain || !/^https?:\/\//i.test(trimmed)) return plain;
  return parse_build(URL.parse(trimmed)?.searchParams.get(BUILD_PARAM));
}

export function build_summary(build: Build): BuildSummary {
  const parts = SLOT_NAMES.filter((slot) => slot !== "tyres" && build.parts[slot] !== DEFAULT_PARTS[slot]).map((slot) => `${SLOTS[slot].label}: ${part_of(slot, build.parts[slot]).name}`);
  return { code: build_code(build), car: CARS[build.car].name, rating: rating(build), facts: car_facts(build), parts };
}

/** The builds a chat message names, bare codes or links carrying `?car=<code>`, each once. */
export function chat_builds(text: string): BuildSummary[] {
  const found: BuildSummary[] = [];
  for (const word of text.split(/\s+/)) {
    const build = build_of(word);
    if (!build) continue;
    const code = build_code(build);
    if (!found.some((each) => each.code === code)) found.push(build_summary(build));
    if (found.length === MAX_CARDS) break;
  }
  return found;
}
