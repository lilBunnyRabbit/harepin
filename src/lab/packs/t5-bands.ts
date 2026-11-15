import type { Mod } from "../../car/build";
import { Trait, trait_asks } from "../ask";
import type { Aids, Pack } from "../pack";

const STURM = "sturm.4.0.0.1.0";
const FUJIN = "fujin.4.0.0.1.0";
const SAJIN = "sajin.4.0.0.1.0";

const TCS_OFF: Aids = { tcs: false, assist: true, stability: true };
const ASSISTS_ON: Aids = { tcs: true, assist: true, stability: true };

// Each lever was walked up in steps; the band edge sits on a cliff, so these are the first values well inside it.
const STURM_LOOSE: Mod[] = [{ add: { rear_grip: -0.14 } }];
const FUJIN_TAMED: Mod[] = [{ add: { rear_grip: 0.017 } }];
const SAJIN_SOFT: Mod[] = [{ scale: { spring: 0.85, damper: 0.85 }, add: { rear_grip: 0.09 } }];

const pack: Pack = {
  id: "t5-bands",
  rev: 1,
  title: "Three doubted bands",
  aim: "Three cars sit outside a draft band on purpose. Drive today's car against a candidate inside the band, then say which one is the car.",
  brief:
    "Slip in the sim, today against the band. Sturm power-on, TCS off, hairpins: 1.2 deg, band 8-20. Fujin lift-off, assists on, r120: 19.1, band 6-12. Sajin lift-off, assists on, r120 and dirt pad: 21.1, band 10-16. Today goes first each time.",
  trials: [
    {
      id: "sturm-pwr-today",
      car: STURM,
      aids: TCS_OFF,
      station: "hairpin",
      lane: "asphalt",
      goal: { kind: "run" },
      try: "TCS off: second gear through each hairpin, then full throttle at the apex with the wheel still in",
      feel: "today's Sturm, rear engine, TCS off: notice whether full gas mid corner ever steps the tail out, or the rear just digs in and pushes",
      question: "Does the Sturm need some power oversteer, or is the rear bite on exit its character?",
      ask: trait_asks(Trait.POWER, Trait.EXIT),
      base: true,
    },
    {
      id: "sturm-pwr-loose",
      car: STURM,
      mods: STURM_LOOSE,
      aids: TCS_OFF,
      station: "hairpin",
      lane: "asphalt",
      goal: { kind: "run" },
      try: "TCS off: second gear through each hairpin, then full throttle at the apex with the wheel still in",
      feel: "rear grip down to the Fujin's, about 12 degrees on power in the sim: notice whether the tail steps out on the gas and comes back when you ease off, or snaps",
      question: "Does the Sturm need some power oversteer, or is the rear bite on exit its character?",
      ask: trait_asks(Trait.POWER, Trait.EXIT),
    },
    {
      id: "fujin-lift-today",
      car: FUJIN,
      aids: ASSISTS_ON,
      station: "sweeper",
      lane: "r120",
      goal: { kind: "run" },
      try: "assists on: hold the r120 sweeper near the limit, then lift off sharply halfway round",
      feel: "today's Fujin on a lift: notice how far the tail swings and whether the assists catch it before you do",
      question: "Should the grippiest car rotate this much when you lift?",
      ask: trait_asks(Trait.LIFT, Trait.BALANCE),
      base: true,
    },
    {
      id: "fujin-lift-tamed",
      car: FUJIN,
      mods: FUJIN_TAMED,
      aids: ASSISTS_ON,
      station: "sweeper",
      lane: "r120",
      goal: { kind: "run" },
      try: "assists on: hold the r120 sweeper near the limit, then lift off sharply halfway round",
      feel: "a touch more rear grip, about 9 degrees on a lift in the sim: notice whether it still tucks the nose in without the tail swinging wide",
      question: "Should the grippiest car rotate this much when you lift?",
      ask: trait_asks(Trait.LIFT, Trait.BALANCE),
    },
    {
      id: "sajin-lift-today",
      car: SAJIN,
      aids: ASSISTS_ON,
      station: "sweeper",
      lane: "r120",
      goal: { kind: "run" },
      try: "assists on: hold the r120 sweeper on the gas, then lift off sharply halfway round",
      feel: "today's Sajin on tarmac: notice the stiffness you had to lift for last time and how far the tail swings when you do",
      question: "On tarmac, does the softened Sajin ride like a buggy and lift without a snap?",
      ask: trait_asks(Trait.LIFT, Trait.BALANCE),
      base: true,
    },
    {
      id: "sajin-lift-soft",
      car: SAJIN,
      mods: SAJIN_SOFT,
      aids: ASSISTS_ON,
      station: "sweeper",
      lane: "r120",
      goal: { kind: "run" },
      try: "assists on: hold the r120 sweeper on the gas, then lift off sharply halfway round",
      feel: "springs and dampers 15% softer, more rear grip, about 12 degrees on a lift in the sim: notice the body leaning and settling, and the tail moving less when you lift",
      question: "On tarmac, does the softened Sajin ride like a buggy and lift without a snap?",
      ask: trait_asks(Trait.LIFT, Trait.BALANCE),
    },
    {
      id: "sajin-dirt-today",
      car: SAJIN,
      aids: ASSISTS_ON,
      station: "skidpad",
      lane: "dirt",
      goal: { kind: "laps", laps: 3 },
      try: "assists on: three laps of the dirt ring at the edge of grip, lift once each lap",
      feel: "today's Sajin on dirt: notice whether it slides loose and soft, or sits stiff and snaps round when you lift",
      question: "On dirt, is the softened Sajin still the loose, playful buggy?",
      ask: trait_asks(Trait.LIFT, Trait.BALANCE),
      base: true,
    },
    {
      id: "sajin-dirt-soft",
      car: SAJIN,
      mods: SAJIN_SOFT,
      aids: ASSISTS_ON,
      station: "skidpad",
      lane: "dirt",
      goal: { kind: "laps", laps: 3 },
      try: "assists on: three laps of the dirt ring at the edge of grip, lift once each lap",
      feel: "the softer Sajin on dirt: notice whether it leans and soaks the ground, and still slides without the snap",
      question: "On dirt, is the softened Sajin still the loose, playful buggy?",
      ask: trait_asks(Trait.LIFT, Trait.BALANCE),
    },
  ],
  ask: trait_asks(Trait.LIFT, Trait.POWER),
};

export default pack;
