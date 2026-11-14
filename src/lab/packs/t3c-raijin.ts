import { BEST, FULL, PAD, PINS, STRAIGHT, top_tier_pack } from "./top-tier";

const pack = top_tier_pack(
  "t3c-raijin",
  "Top tier: Raijin",
  "The Raijin from today's best to every top part on the skidpad, the runway and the hairpins.",
  "raijin",
  [PAD, STRAIGHT, PINS].map((place) => [place, [BEST, FULL]]),
);

export default pack;
