// Laid surfaces drape over the terrain this far up, metres, so they never z-fight it; the wheels feel the terrain under
// them, so the car views stand a car on one by as much (`world/drawn-lift.ts`).
const PAD = 0.06;

export const LIFT = {
  street: 0.025,
  ring: 0.03,
  spur: 0.035,
  mark: 0.045,
  pad: PAD,
  pad_line: 0.09,
  plaza: PAD + 0.04,
} as const;
