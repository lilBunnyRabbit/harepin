import { Difficulty } from "../../ai/difficulty";
import type { FieldCar } from "../../ai/field";
import { NOTE } from "../ask";
import type { Pack, Question } from "../pack";

// Island seed 4: a 5.4 km circuit, one lap of about four minutes, every AI car finishing in the headless field runs.
const MAP = "1C0000004";
const COUPE = "coupe.4.0.0.1.0";
const grid = (aggression: number, mistakes: number): FieldCar[] => Array.from({ length: 6 }, () => ({ aggression, mistakes }));

const ASK: Question[] = [
  { kind: "scale", id: "fair", label: "Fairness", low: "they drove into me", high: "clean racing" },
  { kind: "scale", id: "aggr", label: "Aggression", low: "too timid", high: "too dirty" },
  { kind: "scale", id: "real", label: "Believability", low: "robots on rails", high: "like people" },
  { kind: "scale", id: "pace", label: "Pace", low: "too easy", high: "too hard" },
  NOTE,
];

const pack: Pack = {
  id: "ai-field",
  rev: 1,
  title: "AI field: first look",
  brief: "The stock coupe last on the grid against six AI cars on an island circuit: the start, passing, defending and a mixed field. Each race trial reloads onto the island; answers and numbers keep.",
  aim: "Does the AI race like people: a clean start, real passes, fair defending, drivers that differ?",
  trials: [
    {
      id: "start",
      car: COUPE,
      map: MAP,
      field: { cars: grid(3, 3) },
      goal: { kind: "time", seconds: 60 },
      try: "launch on green from the back and race the pack into the first bends",
      feel: "the grid start, level 3 field: whether it gets away cleanly, leaves you room and strings out like a real start",
      question: "Does the start look and feel like a race?",
    },
    {
      id: "overtakes",
      car: COUPE,
      map: MAP,
      field: { cars: grid(5, 3) },
      goal: { kind: "race" },
      try: "stay with the pack, pass where you can and watch them pass each other",
      feel: "a bold field, aggression 5: whether its passes look committed and fair, and whether it leaves room when you go for a gap",
      question: "Are the passes believable, yours and theirs?",
    },
    {
      id: "defending",
      car: COUPE,
      map: MAP,
      field: { cars: grid(4, 2), difficulty: Difficulty.EASY },
      goal: { kind: "time", seconds: 180 },
      try: "catch the car ahead and attack it on both sides into the braking zones",
      feel: "an easy field, so you catch it: whether a car covers the inside once and holds its line, or weaves and squeezes you",
      question: "Does a car defend fairly?",
    },
    {
      id: "mixed",
      car: COUPE,
      map: MAP,
      field: { cars: [{ aggression: 1, mistakes: 1 }, { aggression: 2, mistakes: 4 }, { aggression: 3, mistakes: 3 }, { aggression: 4, mistakes: 2 }, { aggression: 5, mistakes: 5 }, { aggression: 5, mistakes: 1 }] },
      goal: { kind: "race" },
      try: "the whole race against a field from polite to dirty",
      feel: "a mixed field, every car on its own levels: whether the drivers read as different people, and whether contact felt caused by you or by them",
      question: "Do the drivers feel like different people?",
    },
  ],
  ask: ASK,
};

export default pack;
