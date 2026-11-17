import { keys_text, type Bindable, type Bindings } from "../hud/bindings";

export const GUIDE_PAGE = "handbook";
export const GOALS_PAGE = "goals";

type Line = string | ((bindings: Bindings) => string);

export interface Point {
  label: string;
  line: Line;
}

export interface Topic {
  id: string;
  title: string;
  line: string;
  art: string;
  /** Its own page reads these; a topic without points opens `door` straight away. */
  points: readonly Point[];
  door: string;
  verb: string;
}

const keys =
  (text: (keys: string) => string, ...actions: Bindable[]) =>
  (bindings: Bindings) =>
    text(actions.map((action) => keys_text(bindings[action]) || "its key").join(" / "));

export const TOPICS: readonly Topic[] = [
  {
    id: "driving",
    title: "Driving",
    line: "Keys, pad, touch and the assists",
    art: "mainland",
    points: [
      { label: "Gas, brake, steer", line: keys((k) => `${k} on keys, the triggers and left stick on a pad, the pedals and a drag on touch.`, "throttle", "brake", "steer_left", "steer_right") },
      { label: "Handbrake", line: keys((k) => `${k} locks the rear wheels for a tight turn. On a phone it is the round pad above the brake.`, "handbrake") },
      { label: "Rewind and reset", line: keys((k) => `Hold ${k} to run time back, or reset to stand the car on the road again.`, "rewind") },
      { label: "Assists", line: "Traction control, ABS, steering assist and stability each switch on their own. The Easy, Balanced and Pro presets set them in one go." },
      { label: "Gears", line: "Automatic shifts for you. Manual gives you the shift keys and the choice of gear." },
    ],
    door: "driving",
    verb: "Open Driving settings",
  },
  {
    id: "events",
    title: "Events and stars",
    line: "Flags, star times, tiers",
    art: "raceway",
    points: [
      { label: "Flags", line: "Every event starts at a flag on a map. Start it from the menu, or drive up to the flag on the road." },
      { label: "Stars", line: "Each event has three marks to beat. Every mark you beat is a star, and your best run keeps its stars." },
      { label: "Tiers", line: "Stars open the next career tier, with new events and maps." },
      { label: "Class limit", line: "Some events take cars up to a class. The start sheet shows the limit and which of your cars fit." },
      { label: "Runs", line: "A new daily and weekly run for everyone, plus random and built runs. They earn season stars." },
    ],
    door: "tiers",
    verb: "Open Career",
  },
  {
    id: "series",
    title: "Harepin Series",
    line: "Rounds, points, the standings",
    art: "alpine",
    points: [
      { label: "Rounds", line: "A season is a run of rounds, raced in order against the same field of drivers." },
      { label: "Points", line: "Your finishing place scores points: 10 for a win, then 8, 6, 5, 4, 3, 2." },
      { label: "Standings", line: "Points add up over the season. The table on Events shows the top drivers and where you stand." },
      { label: "AI racers", line: "Easy, Normal or Hard sets how fast the field drives and how often it slips up. It is under Settings, Driving." },
      { label: "Seasons", line: "Finishing a season opens the next one." },
    ],
    door: "series",
    verb: "Open the Series",
  },
  {
    id: "cars",
    title: "Cars and parts",
    line: "Classes, builds, the Garage",
    art: "velodrome",
    points: [
      { label: "Classes", line: "Every car has a rating and a class from D up to X. Faster parts raise the rating, and with it the class." },
      { label: "Parts", line: "Engine, tyres, aero, suspension, brakes and weight each change how the car drives. Try one and the meters show the gain or loss." },
      { label: "Fits or over class", line: "A part that pushes the car past an event's class limit is marked, so a build stays legal for it." },
      { label: "Builds", line: "Save a car you like under a name and switch between builds in the Garage." },
      { label: "Paint", line: "Colour, decal and race number are free and change nothing about the drive." },
    ],
    door: "garage",
    verb: "Open the Garage",
  },
  {
    id: "maps",
    title: "Maps",
    line: "Travel, roll or make one",
    art: "island-map",
    points: [
      { label: "Travel", line: "Pick a map on Home, Maps and travel there. The game loads it and puts you on its road." },
      { label: "Roll", line: "Every number is a different map of its type. Roll a new one, or type a number a friend sent you." },
      { label: "Make", line: "Make a map sets the terrain, the roads and the towns yourself, and gives the map a code to share." },
      { label: "Map key", line: keys((k) => `${k} opens the road map while you drive: your car, the flags and the other players.`, "map") },
      { label: "Records", line: "Times belong to the map they were set on. A new map starts with a clean sheet." },
    ],
    door: "maps",
    verb: "Open Maps",
  },
  {
    id: "try",
    title: "Things to try",
    line: "Jumps, drift zones, the sky track",
    art: "sky",
    points: [],
    door: GOALS_PAGE,
    verb: "Open Things to try",
  },
];

export const line_of = (point: Point, bindings: Bindings) => (typeof point.line === "string" ? point.line : point.line(bindings));
