import { DEFAULT_PARTS, SLOTS, type Build, type Slot } from "./build";
import { CARS } from "./cars";
import { pi } from "./pi";

// The order a garage fits upgrades in, grip and brakes ahead of power: each rung is one part on top of the rungs below.
// Turbo is left out for its lag, slicks for being hopeless off the tarmac a field drives onto.
const RUNGS: readonly (readonly [Slot, string])[] = [
  ["tyres", "Sport"],
  ["brakes", "Sport"],
  ["engine", "Tuned"],
  ["weight", "Light"],
  ["engine", "Race"],
  ["tyres", "Semi-slick"],
  ["brakes", "Race"],
  ["weight", "Stripped"],
  ["engine", "Supercharger"],
  ["engine", "Twin turbo"],
  ["weight", "Carbon shell"],
];

const LADDER = RUNGS.map(([slot, name]) => {
  const index = SLOTS[slot].parts.findIndex((part) => part.name === name);
  if (index < 0) throw new Error(`no ${slot} part "${name}"`);
  return { slot, index };
});
const LADDER_SLOTS = [...new Set(LADDER.map((rung) => rung.slot))];

// A part off the ladder (rally tyres, a turbo) is the build's character, and so are an off-road car's tyres: they stay.
function climbs(base: Build, slot: Slot): boolean {
  const part = base.parts[slot];
  if (slot === "tyres" && CARS[base.car].offroad > 0) return false;
  return part === DEFAULT_PARTS[slot] || LADDER.some((rung) => rung.slot === slot && rung.index === part);
}

export function upgrade_steps(base: Build): Build[] {
  const open = LADDER_SLOTS.filter((slot) => climbs(base, slot));
  const parts = { ...base.parts };
  for (const slot of open) parts[slot] = DEFAULT_PARTS[slot];
  const steps = [{ ...base, parts: { ...parts } }];
  for (const rung of LADDER) {
    if (!open.includes(rung.slot)) continue;
    parts[rung.slot] = rung.index;
    steps.push({ ...base, parts: { ...parts } });
  }
  return steps;
}

/** `base` itself when no step of its ladder rates `floor` to `ceiling`. */
export function build_at_pi(base: Build, target: number, floor: number, ceiling: number): Build {
  let best = base;
  let gap = Infinity;
  for (const step of upgrade_steps(base)) {
    const rated = pi(step);
    if (rated < floor || rated > ceiling || Math.abs(rated - target) >= gap) continue;
    best = step;
    gap = Math.abs(rated - target);
  }
  return best;
}
