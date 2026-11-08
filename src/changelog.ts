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

const { NEW, IMPROVED } = ChangeKind;

// Newest first; the top entry is the package.json version (version.test.ts).
export const CHANGELOG: Release[] = [
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
