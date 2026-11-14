import { BEST, FULL, GT, PAD, SLICK, SWEEP, top_tier_pack } from "./top-tier";

const pack = top_tier_pack(
  "t3b-sturm-grip",
  "Top tier: Sturm grip",
  "The Sturm on the grip parts: slicks on the skidpad, the GT kit in the r = 200 sweeper, each against today's best and every top part.",
  "sturm",
  [
    [PAD, [BEST, SLICK, FULL]],
    [SWEEP, [BEST, GT, FULL]],
  ],
);

export default pack;
