export const ChangeKind = {
  NEW: "new",
  IMPROVED: "improved",
  FIXED: "fixed",
} as const;
export type ChangeKind = (typeof ChangeKind)[keyof typeof ChangeKind];

export interface Change {
  kind: ChangeKind;
  text: string;
}

export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  changes: Change[];
}

const { NEW, IMPROVED, FIXED } = ChangeKind;

// Newest first; the top entry is the package.json version (version.test.ts).
export const CHANGELOG: Release[] = [
  {
    version: "0.9.2",
    date: "2026-11-09",
    title: "Keyboard steering",
    changes: [
      { kind: NEW, text: "Pick how the keyboard steers in Settings, Controls: Classic, Hold, or the new Smooth, which turns as far as the tyres can grip, nudges on a tap and unwinds gently when you let go." },
      { kind: NEW, text: "Precision steer key: switch it on in Settings, then hold X to halve your steering for fine lines." },
    ],
  },
  {
    version: "0.9.1",
    date: "2026-11-09",
    title: "Cleaner road, dash switches",
    changes: [
      { kind: NEW, text: "TC, ABS, Assist and Auto now sit in a row inside the speedo box. Click one to switch it." },
      { kind: NEW, text: "Put the dash at the bottom right or the bottom centre: Settings, Display." },
      { kind: FIXED, text: "No more thin light streaks across the road on bends, and the centre line no longer breaks up on curves." },
      { kind: FIXED, text: "Picking a world in the menu drives it right away instead of opening the menu again." },
      { kind: FIXED, text: "The Keep driving picture no longer disappears when you hover it." },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-11-09",
    title: "Main menu",
    changes: [
      { kind: NEW, text: "A main menu with Play, Garage, Online and Settings tabs. Pick Island or Sky Track, roll a new map, join friends or tune your car from big picture tiles. Open it with the menu button, Esc or Start." },
      { kind: NEW, text: "The game remembers the last world you picked and picks up there next time." },
      { kind: IMPROVED, text: "Settings now hold only real settings: Graphics, Display, Controls and Audio." },
      { kind: IMPROVED, text: "On phones, Back steps through the menu instead of closing the app." },
      { kind: FIXED, text: "On short phone screens, every settings page scrolls to its last control." },
    ],
  },
  {
    version: "0.8.2",
    date: "2026-11-09",
    title: "Boost pads",
    changes: [
      { kind: NEW, text: "Boost pads on the Sky Track: drive over the arrows for a short burst of speed. The World map shows where they are." },
    ],
  },
  {
    version: "0.8.1",
    date: "2026-11-09",
    title: "HUD fixes",
    changes: [
      { kind: IMPROVED, text: "Classic is the default HUD layout again. A layout you picked yourself stays." },
      { kind: FIXED, text: "In Minimal, the TC, ABS, Assist and Auto switches stay on screen, so you can click them." },
      { kind: FIXED, text: "The speedo keeps one width instead of growing and shrinking with speed." },
      { kind: IMPROVED, text: "Nitro is on Shift only; N no longer fires it." },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-11-09",
    title: "Sky Track",
    changes: [
      { kind: NEW, text: "Sky Track: a toy-style track floating above the clouds, with banked curves, drops, gap jumps and open stretches without rails. Pick it on the World screen; fall off and you're back at the last gate." },
      { kind: NEW, text: "On phones, the garage is a thumb-side sheet with labelled slots, a swipeable part strip and a big Done button." },
      { kind: NEW, text: "On phones, nitro is a tap key on the left: tap to boost, tap again to stop, so your thumb can stay on the gas." },
      { kind: IMPROVED, text: "On phones, steering and the pedals cover the whole lower corners, so you don't miss them, and you can slide between them without lifting." },
      { kind: IMPROVED, text: "Driving aids: a lit lamp now means on, a TC OFF style badge shows on the speedo when one is off, and on phones they sit in their own menu." },
      { kind: FIXED, text: "Sound starts on your first tap on phones, without leaving and reopening the app." },
      { kind: FIXED, text: "Join their map no longer sits on top of the pedals." },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-11-09",
    title: "Dream garage",
    changes: [
      { kind: NEW, text: "Two new cars: Sturm, a wide-body air-cooled coupe with the engine in the back, and Raijin, a turbo all-wheel-drive sedan with a full kit." },
      { kind: NEW, text: "Aero kits: a Street kit and a Race kit add a lip or splitter, side skirts, a diffuser and a bigger wing." },
      { kind: NEW, text: "Create your own theme: roll one, adjust colour strength and contrast, lock the colours you like, then name and save it." },
      { kind: NEW, text: "Pick a HUD layout in Settings: Minimal (the new default), Classic, Racing or Compact." },
      { kind: NEW, text: "Dash switches for traction control, ABS, steer assist and the gearbox, with a lamp that lights when an aid is off." },
      { kind: IMPROVED, text: "On phones the controls are see-through and the HUD fades while you drive, so you see more of the road." },
      { kind: IMPROVED, text: "The garage holds the car still while you swap parts, so you see exactly what changed." },
      { kind: FIXED, text: "With traction control off, holding full lock and full throttle keeps the wheels turned, so you can do donuts." },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-11-09",
    title: "Build your car",
    changes: [
      { kind: NEW, text: "Parts for every car: engine, tyres, spoiler, suspension, brakes, weight, brake bias and nitro. Each one changes how the car drives, and most show on the car." },
      { kind: NEW, text: "A new garage: the car fills the screen, turns to the part you pick, and the meters preview a part before you fit it. Drag to turn it, pinch or scroll to zoom." },
      { kind: NEW, text: "Nitro: fit a tank, hold Shift, N or B. Drifts, jumps and near misses fill it." },
      { kind: NEW, text: "A formula car: light, fast and glued to the road by downforce, but lost on grass." },
      { kind: NEW, text: "A new circuit on every island, with a hairpin climb up the mountain and real hills. Lap records start fresh." },
      { kind: NEW, text: "Servers: see open games, join one, or make a room with a password. Join their map takes you to a friend on another island." },
      { kind: NEW, text: "World screen: pick or roll an island seed and see its map before you drive it." },
      { kind: NEW, text: "Every menu works with a controller." },
      { kind: NEW, text: "Restart the lap from the lap strip or with L." },
      { kind: IMPROVED, text: "Engines and other sounds sit an octave lower, and mute fully stops the sound." },
      { kind: IMPROVED, text: "Night scenes: headlights light things up without blowing them out, warm white lamps, a calmer sun, and car trim that stands out from the road." },
      { kind: IMPROVED, text: "The muscle car grips better and every car stops shorter." },
      { kind: IMPROVED, text: "The coupe has a rounder nose and a fastback roof." },
      { kind: IMPROVED, text: "Pinch to zoom the camera on phones. On desktop the garage, settings, chat and modes buttons sit at the bottom left." },
      { kind: FIXED, text: "Cars pull out of tight uphill hairpins at full lock instead of bogging down." },
      { kind: FIXED, text: "Skid marks show on the road again." },
      { kind: FIXED, text: "A car in neutral no longer rolls on flat ground, and cars no longer look sunk into the road." },
      { kind: FIXED, text: "Long room names no longer push into the lap strip." },
    ],
  },
  {
    version: "0.5.1",
    date: "2026-11-09",
    title: "Quiet pocket",
    changes: [
      { kind: FIXED, text: "Sound stops while the app is in the background." },
      { kind: FIXED, text: "The speed box on phones fits three-digit speeds without pushing the gear out." },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-11-09",
    title: "Air time",
    changes: [
      { kind: NEW, text: "Jumps on the race track, some with a wall, hoop or bar to fly through, plus cone and barrel chicanes." },
      { kind: NEW, text: "Drift suspension in the garage: a stiff rear that steps out easily, with extra steering lock to catch it." },
      { kind: NEW, text: "Button steering on touch screens: Settings, Controls, Touch steering." },
      { kind: IMPROVED, text: "The rally car is at home off-road: nearly tarmac pace on grass, and it lands jumps upright." },
      { kind: IMPROVED, text: "Sharper graphics on phones." },
      { kind: FIXED, text: "Cars no longer spin out when landing a jump at speed." },
      { kind: FIXED, text: "The update card's buttons stay on screen on phones." },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-11-09",
    title: "Jumps, parking and personality",
    changes: [
      { kind: NEW, text: "Parking: eight levels from a wide bay to a tight reverse-in garage, with a high camera and up to three stars." },
      { kind: NEW, text: "Drift zones, gate hunt and ghost duel: three new modes with five levels each." },
      { kind: NEW, text: "Jumps across the island, some with a wall, hoop or bar to fly through. Miss and you bonk." },
      { kind: NEW, text: "Cones, barrels and hay bales to knock over, plus rocks and barriers that don't move." },
      { kind: NEW, text: "Decals in the garage: stripes, a number roundel, flames, a slash, a checker band and a rabbit, in any paint colour. Other players see yours." },
      { kind: NEW, text: "Pick a name the first time you play. Change it any time in Settings, Lobby." },
      { kind: IMPROVED, text: "Every car has its own body, handling and engine sound: a nimble hatch, a heavy V8 muscle car, a turbo rally car, a V6 Kaze and a straight-six coupe." },
      { kind: IMPROVED, text: "Stronger brakes on every car." },
      { kind: IMPROVED, text: "On touch screens, drag on empty screen to look around and double-tap to recenter." },
      { kind: FIXED, text: "Cars no longer roll away or creep when stopped, even on steep slopes." },
      { kind: FIXED, text: "Cars no longer spin out flat out on grass." },
      { kind: FIXED, text: "Roads no longer fold over themselves at sharp corners." },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-11-08",
    title: "Talk and look",
    changes: [
      { kind: NEW, text: "Kaze: a front-mid V6 sports coupe, rear-drive and the easiest car to hold sideways on the throttle." },
      { kind: IMPROVED, text: "Chat has its own button with an unread count, and opens a panel with the whole conversation and a Send button. Press T or Enter to type." },
      { kind: NEW, text: "Recenter the camera behind your car: the button that shows when you look away, F, double-click, or R3 on a gamepad." },
      { kind: IMPROVED, text: "The key list no longer sits in the corner: press H to open it, and assist keys show a short note when you switch them." },
      { kind: IMPROVED, text: "Smoother camera: no more shake on high refresh rate screens, and dragging to look around turns evenly." },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-11-08",
    title: "First lap",
    changes: [
      { kind: NEW, text: "Every room has its own island, grown from a seed, with towns, streets and lit shopfronts at night." },
      { kind: NEW, text: "Four cars to drive and a garage to paint them, add a spoiler and tune the engine and suspension." },
      { kind: NEW, text: "Drive with friends in the same room, chat with them, and race them round the lobby circuit." },
      { kind: NEW, text: "Gymkhana: levels of gates and slaloms against the clock, with stars to earn." },
      { kind: NEW, text: "Ghost laps, rewind, assists, themes and settings for graphics, controls, display and sound." },
      { kind: NEW, text: "Look around your car: drag with the mouse to orbit, scroll to zoom, or use the right stick." },
      { kind: NEW, text: "Keyboard steering can hold the wheel where you leave it and let it self-centre as you roll." },
      { kind: NEW, text: "Touch controls for phones, held sideways." },
      { kind: NEW, text: "Install Harepin as an app and drive offline; it tells you when a new version is ready." },
    ],
  },
];
