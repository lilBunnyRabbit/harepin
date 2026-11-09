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
