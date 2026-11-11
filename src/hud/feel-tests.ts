import { SteerMode } from "../car/car";
import { PRESETS } from "../car/presets";
import { SpeedZoom, SteerSensitivity, TouchSteer, type SettingsState } from "../menu/prefs";

export interface FeelTest {
  label: string;
  car: string;
  settings: Partial<SettingsState>;
  respawn: boolean;
  try: string;
  feel: string;
}

export function feel_car(car: string): string {
  return PRESETS.find((preset) => preset.name === car)?.code ?? car;
}

const BALANCED = { tcs: true, abs: true, assist: false, stability: true, auto: true };
const NO_AIDS = { tcs: false, abs: false, assist: false, stability: false, auto: true };
const ALL_AIDS = { tcs: true, abs: true, assist: true, stability: true, auto: true };
const SMOOTH = { steer_mode: SteerMode.SMOOTH, touch_steer: TouchSteer.DRAG, steer_sensitivity: SteerSensitivity.MEDIUM };
const CAMERA = { speed_zoom: SpeedZoom.SUBTLE, camera_tilt: false };

export const FEEL_TESTS: readonly FeelTest[] = [
  {
    label: "A",
    car: "Easy cruiser",
    settings: { ...BALANCED, ...SMOOTH, ...CAMERA },
    respawn: true,
    try: "a lane change at 100 and a long bend",
    feel: "the front grips, no scrub",
  },
  {
    label: "B",
    car: "Easy cruiser",
    settings: { ...NO_AIDS, ...SMOOTH, ...CAMERA },
    respawn: true,
    try: "a lane change at 100 and a long bend",
    feel: "grips until you overdo it",
  },
  {
    label: "C",
    car: "Drift",
    settings: { ...BALANCED, ...SMOOTH, ...CAMERA },
    respawn: true,
    try: "full lock + full gas from rest; rolling: handbrake tap at full lock then gas",
    feel: "kicks out sooner, holds 30-45 km/h, catchable on full gas",
  },
  {
    label: "D",
    car: "Dirt rally",
    settings: { ...BALANCED, ...SMOOTH, ...CAMERA },
    respawn: true,
    try: "dirt, sand and grass",
    feel: "lively but catchable",
  },
  {
    label: "E",
    car: "Maxed F1",
    settings: { ...BALANCED, ...SMOOTH, ...CAMERA },
    respawn: true,
    try: "a long fast sweeper and a weave",
    feel: "a calm view that still follows the turn",
  },
  {
    label: "F",
    car: "Easy cruiser",
    settings: { ...ALL_AIDS, ...SMOOTH, ...CAMERA },
    respawn: true,
    try: "anything",
    feel: "the baseline",
  },
];
