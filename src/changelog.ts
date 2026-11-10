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
    version: "0.17.1",
    date: "2026-11-10",
    title: "Deeper burble",
    changes: [
      { kind: FIXED, text: "Lifting off the throttle gives a deep exhaust burble instead of a bright crackle, and the rev limiter no longer crackles." },
    ],
  },
  {
    version: "0.17.0",
    date: "2026-11-10",
    title: "Off the road",
    changes: [
      { kind: NEW, text: "Things to try: a list of goals in the Play tab that shows you everything Harepin has, with a Go button for each." },
      { kind: NEW, text: "Offroad tyres: All-terrain and Mud-terrain grip far better on grass and dirt, and give up a little on tarmac." },
      { kind: NEW, text: "Lifted suspension: more ride height and travel for rough ground and hard landings." },
      { kind: IMPROVED, text: "Rally tyres grip a little better on dirt and grass." },
      { kind: FIXED, text: "The crackle when you lift off the throttle is short and sharp again, not a low thump." },
    ],
  },
  {
    version: "0.16.0",
    date: "2026-11-10",
    title: "Proper junctions",
    changes: [
      { kind: NEW, text: "Where roads meet, the island now has real junctions: rounded corners, one smooth patch of asphalt and give-way lines." },
    ],
  },
  {
    version: "0.15.0",
    date: "2026-11-10",
    title: "Calmer touch steering",
    changes: [
      { kind: NEW, text: "Steering sensitivity for drag steering on touch screens, from Low to Very high, in Controls." },
      { kind: IMPROVED, text: "Drag steering is calmer by default: full lock needs a longer drag. High is the old feel." },
    ],
  },
  {
    version: "0.14.1",
    date: "2026-11-10",
    title: "Tidy chip",
    changes: [
      { kind: FIXED, text: "The online chip sits centred under the map." },
    ],
  },
  {
    version: "0.14.0",
    date: "2026-11-10",
    title: "Who else is here",
    changes: [
      { kind: NEW, text: "A small chip under the map shows how many players are on your map and online. Tap it for the Online tab." },
      { kind: NEW, text: "Other players show on the minimap and the world map, with their names." },
      { kind: NEW, text: "M opens the world map. The automatic gearbox toggle moves to 4." },
      { kind: NEW, text: "You see a short note when someone joins or leaves your room." },
      { kind: IMPROVED, text: "Keyboard steering defaults to Smooth. If you were on the old Classic default, you move to Smooth once." },
      { kind: IMPROVED, text: "The guide and settings say plainly that turning steering assist off makes the car slide much sooner." },
    ],
  },
  {
    version: "0.13.1",
    date: "2026-11-10",
    title: "Small fixes",
    changes: [
      { kind: FIXED, text: "What's new scrolls with the arrow keys and gets more room on phones." },
      { kind: FIXED, text: "The racing tag in the players list no longer gets cut off on phones." },
      { kind: FIXED, text: "Typing a room password no longer cuts the players list in half." },
    ],
  },
  {
    version: "0.13.0",
    date: "2026-11-10",
    title: "Bus and friends online",
    changes: [
      { kind: NEW, text: "A city bus: 12 metres, eleven tonnes, leans into every corner. Parking and gymkhana are too tight for it." },
      { kind: NEW, text: "Players online in the Online tab: who is playing, where, their flag and ping, and Join to drive with them." },
      { kind: NEW, text: "Leave room takes you back to the open lobby on the same map." },
      { kind: IMPROVED, text: "Phones on mobile data can now connect to other players through a relay when a direct link fails." },
      { kind: IMPROVED, text: "Connection status lives in the Online tab, and it tells you when the network blocks a connection." },
      { kind: IMPROVED, text: "Shared links show a Harepin card with the tuned Sturm." },
      { kind: FIXED, text: "The guide now mentions that you can switch cars." },
    ],
  },
  {
    version: "0.12.0",
    date: "2026-11-10",
    title: "Maps, keys and ready-up",
    changes: [
      { kind: NEW, text: "Map setting in Display: full map, a heading-up close-up, rally pace notes, or off. The map follows the route you race." },
      { kind: NEW, text: "Change keys and pad buttons in Controls. Taking a key from another action says so, and Reset puts them back." },
      { kind: NEW, text: "Ready up in lobby races: the race starts when everyone is ready, and the lobby shows who it is waiting for." },
      { kind: IMPROVED, text: "Updates wait in the menu: an Update ready chip opens What's new, with only a short note while you drive." },
      { kind: IMPROVED, text: "Multiplayer sends about four times less data per car. Players on older versions are told to update." },
      { kind: FIXED, text: "The lobby race countdown now closes the menu so everyone sees it start." },
      { kind: FIXED, text: "Your name stays the same after skipping the guide." },
      { kind: FIXED, text: "No more scrollbars in the menu." },
    ],
  },
  {
    version: "0.11.2",
    date: "2026-11-10",
    title: "Roomier phone garage",
    changes: [
      { kind: IMPROVED, text: "The garage on phones has more room to breathe, and the part cards fit three across." },
      { kind: FIXED, text: "The selected part card in the garage is no longer cut off at the edge on phones." },
    ],
  },
  {
    version: "0.11.1",
    date: "2026-11-10",
    title: "Faster and steadier",
    changes: [
      { kind: IMPROVED, text: "Islands load much faster: building the roads and terrain takes about a quarter of the time it did." },
      { kind: IMPROVED, text: "Lighter on phones: the scene behind the menu redraws less often, the HUD and minimap do less work each frame, and touch screens skip the costly blur." },
      { kind: IMPROVED, text: "Smoother bloom on desktop, now anti-aliased." },
      { kind: FIXED, text: "The rev bar and shift light follow each car's own redline, so the Formula no longer maxes out at half revs." },
      { kind: FIXED, text: "Lobby races: everyone agrees on who starts the race, chat reaches every player in the room, and an unanswered race request tells you so." },
      { kind: FIXED, text: "A new room keeps the world you are on." },
    ],
  },
  {
    version: "0.11.0",
    date: "2026-11-10",
    title: "Welcome guide",
    changes: [
      { kind: NEW, text: "First-run guide: new players pick a look, a help level and see the controls and what to do, right in the menu. Reopen it any time from Settings." },
      { kind: FIXED, text: "Joining a Sky game from the server list now opens Sky instead of the island." },
      { kind: FIXED, text: "The Drive button is readable in light themes." },
    ],
  },
  {
    version: "0.10.0",
    date: "2026-11-10",
    title: "Races and wilder worlds",
    changes: [
      { kind: NEW, text: "Races: race the circuit, town-to-town street routes and dirt offroad routes, each with gates, a par time and stars. Lobby races can run on any route." },
      { kind: NEW, text: "Islands have biomes and landmarks: coast, meadow, pine forest and dry upland, with a summit mast, a lighthouse, wind turbines and a rock arch." },
      { kind: NEW, text: "A canyon cuts across every island, with a gap jump on the dirt trails." },
      { kind: NEW, text: "Sky Track layouts twist: hairpins, esses, spiral climbs and crossovers. Rails let you glide along instead of stopping you." },
      { kind: NEW, text: "Everything is in the menu: settings as rows, the garage as a tab with saved builds you can share by code, a Modes page, and What's new." },
      { kind: NEW, text: "New map page: pick a world, roll or type a map code, and see the map with its length, corners and jumps." },
      { kind: IMPROVED, text: "Drifting: with steering assist off, countersteering gets full lock, so you can hold a power drift on the throttle." },
      { kind: IMPROVED, text: "A car sliding fully sideways scrubs speed like real sliding tyres." },
      { kind: FIXED, text: "Reset faces the way you were travelling, not where the nose pointed." },
      { kind: FIXED, text: "The map preview keeps its shape." },
    ],
  },
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
