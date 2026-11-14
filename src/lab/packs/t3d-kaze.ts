import { BEST, FULL, ladder, PAD, PINS, STRAIGHT, top_tier_pack } from "./top-tier";

const pack = top_tier_pack(
  "t3d-kaze",
  "Top tier: Kaze",
  "The Kaze from today's best to every top part on the skidpad, the runway and the hairpins.",
  ladder("kaze", [PAD, STRAIGHT, PINS].map((place) => [place, [BEST, FULL]])),
);

export default pack;
