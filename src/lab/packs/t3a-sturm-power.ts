import { BEST, FULL, PINS, SC, SHELL, SINGLE, STRAIGHT, top_tier_pack, TWIN } from "./top-tier";

const pack = top_tier_pack(
  "t3a-sturm-power",
  "Top tier: Sturm power",
  "The Sturm, closest to S2, on each candidate engine: supercharger, single and twin turbo down the runway, then twin turbo and carbon shell out of the hairpins, each against today's best and every top part.",
  "sturm",
  [
    [STRAIGHT, [BEST, SC, SINGLE, TWIN, FULL]],
    [PINS, [BEST, TWIN, SHELL, FULL]],
  ],
);

export default pack;
