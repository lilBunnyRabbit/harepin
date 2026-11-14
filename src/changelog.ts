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

/** A locked thing shown as an outline only. */
export const TEASE = "tease";

/**
 * One block of a release's story (`menu/release-story.ts`). Without `car` or `was` it is a headline: the first three are
 * the lines of the updated card, and car cards that follow one sit under it.
 */
export interface Highlight {
  kind: ChangeKind | typeof TEASE;
  title: string;
  text: string;
  /** A car id, drawn when this build has that car. A string, not `CarId`: a release may be written before its car lands. */
  car?: string;
  /** Before and now: this `car`, or every car when there is none. The before picture is `public/release/before/<car>.webp`. */
  was?: boolean;
}

export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  changes: Change[];
  /** The release's story, for a big one: the updated card and the Release notes page lead with it. */
  highlights?: Highlight[];
}

const { NEW, IMPROVED, FIXED } = ChangeKind;

/** The next release's story, written ahead of its bump: at release its `highlights` move onto the new top entry of `CHANGELOG`. */
export const DRAFT_HIGHLIGHTS: Highlight[] = [
  { kind: NEW, title: "Two new cars", text: "A pop-up drift hardtop and a sand buggy." },
  { kind: NEW, title: "Tsumuji", text: "A light drift hardtop. Its headlights pop up when you switch the lights on.", car: "tsumuji" },
  { kind: NEW, title: "Sajin", text: "A sand buggy with long-travel suspension and big tyres, built for the dunes.", car: "sajin" },
  { kind: IMPROVED, title: "Every car, restyled", text: "Stock bodies and four aero kits to bolt on.", was: true },
  { kind: TEASE, title: "Something fast is waiting", text: "Win the Legend final to earn it.", car: "fujin" },
  { kind: NEW, title: "Career page", text: "Tiers, cups and rewards on one page." },
  { kind: NEW, title: "Towns", text: "Streets and buildings to drive through." },
  { kind: NEW, title: "Headlights", text: "Switch them on any car. Players online see them." },
];

// Newest first; the top entry is the package.json version (version.test.ts).
export const CHANGELOG: Release[] = [
  {
    version: "0.43.2",
    date: "2026-11-14",
    title: "Hold and spin",
    changes: [
      { kind: FIXED, text: "Car viewer: dragging keeps rotating the car until you let go" },
    ],
  },
  {
    version: "0.43.1",
    date: "2026-11-14",
    title: "Pop-ups",
    changes: [
      { kind: IMPROVED, text: "Tsumuji's pop-up headlights swing open and shut, and the beam waits until they're up" },
      { kind: FIXED, text: "Ghost cars sit on the road surface too" },
    ],
  },
  {
    version: "0.43.0",
    date: "2026-11-14",
    title: "Built to show",
    changes: [
      { kind: NEW, text: "Cars wear details that grow with the parts you fit, in each car's own tuning style" },
      { kind: NEW, text: "Nitro flames leave the pipes the way they point" },
      { kind: FIXED, text: "Tyres sit on the road surface instead of sinking into it, and off-road tread stays inside the tyre" },
      { kind: FIXED, text: "Skid marks no longer draw over the cars" },
      { kind: FIXED, text: "Sajin no longer rolls over on bumps" },
      { kind: IMPROVED, text: "Settings: the version is a pill that opens What's new, next to the Guide" },
      { kind: NEW, text: "Feel lab: Sajin before-and-after pack" },
    ],
  },
  {
    version: "0.42.4",
    date: "2026-11-14",
    title: "Lab briefs",
    changes: [
      { kind: IMPROVED, text: "Feel lab: each trial opens with a brief: the question, what changed against the baseline, what to drive and what to feel for" },
      { kind: IMPROVED, text: "Feel lab: results say what they compare with, in plain words, and hide numbers that mean nothing for the trial" },
    ],
  },
  {
    version: "0.42.3",
    date: "2026-11-14",
    title: "Quiet pause",
    changes: [
      { kind: FIXED, text: "The engine goes quiet while the menu, a lab card or the garage is open, and eases back when you return" },
    ],
  },
  {
    version: "0.42.2",
    date: "2026-11-14",
    title: "Lab notes",
    changes: [
      { kind: IMPROVED, text: "Feel lab: new driving measures and per-trait questions after each trial" },
      { kind: NEW, text: "Feel lab: blind A/B groups, so you rate setups without knowing which is which" },
    ],
  },
  {
    version: "0.42.1",
    date: "2026-11-14",
    title: "Clean lines",
    changes: [
      { kind: FIXED, text: "Wheel arches clear the tyres at full steering lock, with even lips that match the wheels" },
      { kind: FIXED, text: "No more seeing through a car to the far wheel, on every car with arches and on Fujin's wheel pods" },
      { kind: FIXED, text: "Formula: suspension arms meet the wheel hubs, and the driver wears a proper helmet" },
      { kind: FIXED, text: "Sturm's cabin floor no longer pokes into the wide kit's rear arches" },
      { kind: FIXED, text: "The Velodrome picture shows in the guide and on the Legend final" },
      { kind: IMPROVED, text: "Smoother driving on Sky Track and faster road building on Mainland" },
      { kind: IMPROVED, text: "Sharper names and north marker on the minimap" },
    ],
  },
  {
    version: "0.42.0",
    date: "2026-11-14",
    title: "Fresh metal",
    highlights: DRAFT_HIGHLIGHTS,
    changes: [
      { kind: NEW, text: "Legend tier: 12 events ending in the Velodrome final, with carbon paint, the Lanes decal and the Legend champion badge to earn" },
      { kind: NEW, text: "Two new cars: Tsumuji, a light drift hardtop with pop-up headlights, and Sajin, a sand buggy built for the dunes" },
      { kind: NEW, text: "A reward car waits for Legend champions" },
      { kind: IMPROVED, text: "Every car restyled: a stock body plus four aero kits to bolt on, a new nitro flame and a softer nitro sound" },
      { kind: NEW, text: "Career page: your rank, next goals and every tier's rewards on one page" },
      { kind: NEW, text: "Mainland towns rebuilt with main streets and a clock-tower square. Mainland records and ghosts start fresh" },
      { kind: NEW, text: "Headlights switch on any car (N, D-pad up, or the aids and phone menus); players online see them" },
      { kind: IMPROVED, text: "Car pick and garage cards show drive and tyre icons, and the garage switches cars faster" },
      { kind: IMPROVED, text: "Smoother menus on phones" },
      { kind: FIXED, text: "HUD buttons no longer overlap the map or spill off the dash, and the car shadow no longer cuts across the tyres" },
    ],
  },
  {
    version: "0.41.1",
    date: "2026-11-13",
    title: "Smoother on phones",
    changes: [
      { kind: IMPROVED, text: "Smoother driving on phones: the dashboard no longer makes the browser restyle the whole page every frame" },
      { kind: IMPROVED, text: "Mainland builds faster when you load it" },
      { kind: FIXED, text: "Restart and Quit buttons on the Play tab no longer spill off the card for long mode names" },
    ],
  },
  {
    version: "0.41.0",
    date: "2026-11-13",
    title: "Road trip",
    changes: [
      { kind: NEW, text: "Mainland road trip: race between the two towns farthest apart. Sprint and road trip are in the event builder too." },
      { kind: NEW, text: "Banked run on Sky Track: the most-banked stretch of the circuit." },
      { kind: IMPROVED, text: "Phone HUD: only driving controls stay on screen; everything else lives in one menu. A Rewind / Reset prompt shows when you're stuck." },
    ],
  },
  {
    version: "0.40.1",
    date: "2026-11-13",
    title: "Pick a car",
    changes: [
      { kind: IMPROVED, text: "The car pick is a sideways strip of classes with buttons to jump between them, and every car shows its drive, tyres, weight and power, grip and top speed." },
    ],
  },
  {
    version: "0.40.0",
    date: "2026-11-13",
    title: "Seasons",
    changes: [
      { kind: NEW, text: "Seasons: four weeks long, earn season stars in Runs for titles and a name tag tint other players see." },
      { kind: NEW, text: "Daily board: the online lobby lists today's daily times and scores of the players around you." },
      { kind: NEW, text: "Weekly cup: a 3-stage championship on one map each week, up to 5 season stars." },
    ],
  },
  {
    version: "0.39.0",
    date: "2026-11-13",
    title: "Elite complete",
    changes: [
      { kind: NEW, text: "Elite is complete: five more events (a drift chain, speed traps, a long jump, the Island cup championship and the Dune crossing final on Big dunes)." },
      { kind: NEW, text: "Championships: several stages on one map, points per stage, standings on the result card. A stage needs 1 star to go on." },
      { kind: NEW, text: "Win the Elite final for the platinum E shield, and earn every Elite star for the Ridges decal." },
      { kind: FIXED, text: "Jump events no longer depend on how fast the map loads." },
    ],
  },
  {
    version: "0.38.0",
    date: "2026-11-13",
    title: "New ways to drive",
    changes: [
      { kind: NEW, text: "Runs: a daily event, endless random events and an event builder. Pick the type, world, length, laps, difficulty and car, then generate a map and share it by link. Runs earn season stars, up to 10 a day." },
      { kind: NEW, text: "Three new event types: drift chain (one chain, lose it and the run ends), speed trap (your speed through traps on the straights adds up) and jump distance (longest flight off a ramp)." },
      { kind: NEW, text: "Change car mid-event: in a career event with a class limit, the car button or the result card reopens the car pick and restarts the run." },
      { kind: IMPROVED, text: "The car pick groups cars by class, side by side on wide screens, with Your car, Recommended and Fitted tags and a link to the garage." },
      { kind: IMPROVED, text: "The garage paint and part strip has arrows on desktop." },
      { kind: FIXED, text: "Metallic paints no longer blow out to white under a low sun." },
    ],
  },
  {
    version: "0.37.2",
    date: "2026-11-14",
    title: "Chip in",
    changes: [
      { kind: NEW, text: "A Sponsor button in the menu, if you'd like to support Harepin. Totally optional: the game stays free." },
    ],
  },
  {
    version: "0.37.1",
    date: "2026-11-14",
    title: "Pick a car",
    changes: [
      { kind: FIXED, text: "The car pick before an event shows its cars as cards again, instead of bare text." },
      { kind: IMPROVED, text: "The event's class limit stands out at the top of the car pick, and the strongest car that fits is marked Recommended." },
    ],
  },
  {
    version: "0.37.0",
    date: "2026-11-14",
    title: "Elite",
    changes: [
      { kind: NEW, text: "Career Elite tier: seven new events for drivers with 16 Pro stars, with tighter star times and a platinum paint to earn." },
      { kind: IMPROVED, text: "The whole menu is rebuilt: one set of buttons, rows and cards, roomier rows, and pages that fit phones in landscape and portrait." },
      { kind: IMPROVED, text: "Settings show what each driving aid does when on and when off, and long help text scrolls instead of being cut off." },
      { kind: IMPROVED, text: "Online and room pages no longer clip on narrow phones, and the first-run guide fits a phone screen." },
      { kind: IMPROVED, text: "Worlds load faster and driving makes less garbage, so frame times stay steadier on phones." },
      { kind: FIXED, text: "The Play map fills its panel on phones in landscape." },
    ],
  },
  {
    version: "0.36.2",
    date: "2026-11-13",
    title: "Tell me",
    changes: [
      { kind: NEW, text: "A Support tab: Harepin is still being built, so report bugs, driving feel, maps, performance or ideas straight to GitHub, with your version and device filled in." },
      { kind: NEW, text: "Settings and your career shield sit in the top bar while you drive. The shield turns to metal once you win the tier's final." },
      { kind: IMPROVED, text: "Ice parallel hands you the Dirt rally car, so parking on ice is doable." },
      { kind: FIXED, text: "Lava keeps its orange-red glow in every dusk theme." },
    ],
  },
  {
    version: "0.36.1",
    date: "2026-11-13",
    title: "Career first",
    changes: [
      { kind: NEW, text: "The Play page leads with your career: your tier, stars toward the next tier, the next event and a Continue career button." },
      { kind: IMPROVED, text: "Restart a career or mode run any time: the restart button stays on screen during runs, and the menu has Restart next to Quit." },
      { kind: IMPROVED, text: "Volcano lava glows hot orange-red, and the crater wall fades into it." },
      { kind: IMPROVED, text: "Desert highlands read as sand in daylight." },
      { kind: IMPROVED, text: "Events with a set car show it as a car, for example Drift car." },
    ],
  },
  {
    version: "0.36.0",
    date: "2026-11-12",
    title: "New light",
    changes: [
      { kind: IMPROVED, text: "Drifting with steering assist off: the wheel now turns fully into the turn, and a held drift grips and tightens instead of sliding wide. The feel panel can switch it off." },
      { kind: NEW, text: "Each land has its own props: charred trees, basalt and glowing vents on the Volcano; snow poles, drifts and capped boulders in the snow; scree and snow fences in the Alps." },
      { kind: IMPROVED, text: "A new look: the road reads at dusk under brighter headlights, snow stays cool at dusk, dunes are sand in daylight, towns have pale walls and windows, and Sky Track no longer washes out in the day." },
      { kind: IMPROVED, text: "Ground colours sit per face, and the saw-tooth edges beside roads are gone." },
      { kind: IMPROVED, text: "Reward paints shine like real metal, and reward decals show on the roof and tail where you can see them while driving." },
      { kind: IMPROVED, text: "Big dunes are mostly smaller, with a few tall ridges as landmarks." },
      { kind: IMPROVED, text: "Career c6 Mainland sprint is a full 7 km run with new star times." },
      { kind: IMPROVED, text: "New players start in a blue car that stands out from the grass." },
      { kind: FIXED, text: "Volcano lava shows and glows again, and driving into it resets the car." },
      { kind: FIXED, text: "Hovering paints in the garage no longer shifts the list." },
    ],
  },
  {
    version: "0.35.1",
    date: "2026-11-12",
    title: "Room to land",
    changes: [
      { kind: IMPROVED, text: "Big dunes: more room behind crest jumps, so a jump lands clear of the next dune." },
      { kind: IMPROVED, text: "Career c6 is now the Mainland sprint: a 4 minute run over part of the Mainland circuit. Circuit sprint is also in free-play Race on Mainland." },
      { kind: FIXED, text: "Coming back to the game no longer fails to load with the menu open." },
      { kind: FIXED, text: "Jump decks no longer flicker against the ground." },
    ],
  },
  {
    version: "0.35.0",
    date: "2026-11-12",
    title: "Rewards and flags",
    changes: [
      { kind: NEW, text: "Career rewards: 10 stars in a tier earn a metallic paint (bronze, silver, gold), all 21 earn a decal from the tier final's world, and finishing the final earns a tier badge." },
      { kind: NEW, text: "Your tier badge shows on the career page, in the players list and above your car for other drivers." },
      { kind: NEW, text: "Career start flags in the world: slow down at a flag to see the event, then tap Start or press restart. Flags show on the minimap and the map; locked events are grey." },
      { kind: NEW, text: "Career events on Mainland: the Mainland lap and the Marathon duel now run on the real Mainland." },
      { kind: IMPROVED, text: "The result screen shows what you just unlocked, with a button to try it in the garage." },
      { kind: FIXED, text: "Repainting a borrowed event car no longer earns garage goals." },
    ],
  },
  {
    version: "0.34.0",
    date: "2026-11-12",
    title: "Career",
    changes: [
      { kind: NEW, text: "Career: 21 events in three tiers, Rookie, Club and Pro, across every world. Earn stars to open the next tier; each tier ends with a final on Sky Track, the Volcano descent and Ice canyon." },
      { kind: NEW, text: "Pick your car before an event: events cap the class or hand you a preset, and your own car comes back afterwards." },
      { kind: NEW, text: "Race events have a 3-star ghost to chase. Every hit on a wall or rail adds 2 seconds, and there is no rewind." },
      { kind: IMPROVED, text: "Each event says its goal when it starts, and route events light the next gate." },
      { kind: IMPROVED, text: "Drifting with steering assist off: hold the turn key in a drift and the line tightens instead of washing wide; ease the gas to straighten." },
    ],
  },
  {
    version: "0.33.2",
    date: "2026-11-12",
    title: "Hands on the wheel",
    changes: [
      { kind: IMPROVED, text: "With steering assist off, the front wheels follow only your input in a drift: no automatic countersteer. Assist on keeps the help." },
      { kind: IMPROVED, text: "Ghost duels show light-beam gates and the next gate on the minimap, like races." },
    ],
  },
  {
    version: "0.33.1",
    date: "2026-11-12",
    title: "Tuning",
    changes: [
      { kind: FIXED, text: "Small fixes behind the scenes." },
    ],
  },
  {
    version: "0.33.0",
    date: "2026-11-12",
    title: "Dune sea, rebuilt",
    changes: [
      { kind: NEW, text: "Big dunes is now an 8 km dune sea that loads around you: no roads, dunes from small hops to 80 m giants, and sharp crests that launch you. Off-road cars bash freely. Big dunes records start fresh." },
      { kind: IMPROVED, text: "Reset on Big dunes puts the car back on its wheels where it is." },
    ],
  },
  {
    version: "0.32.1",
    date: "2026-11-12",
    title: "Mini map chips",
    changes: [
      { kind: IMPROVED, text: "Mini maps are back beside the Mainland map as small chips, and the one you're on gets a border instead of a tag." },
    ],
  },
  {
    version: "0.32.0",
    date: "2026-11-12",
    title: "Ice canyon",
    changes: [
      { kind: NEW, text: "Ice canyon: a hairpin road down into a frozen riverbed, with frozen falls to jump on packed snow." },
      { kind: IMPROVED, text: "The Speed Reader themes are gone; if you used one, you now get the Brand theme of the same brightness." },
    ],
  },
  {
    version: "0.31.2",
    date: "2026-11-12",
    title: "Dates",
    changes: [
      { kind: FIXED, text: "Release dates in What's new are right again." },
    ],
  },
  {
    version: "0.31.1",
    date: "2026-11-12",
    title: "Lava in view",
    changes: [
      { kind: IMPROVED, text: "The lava lake shows from the Volcano rim lap. Volcano records start fresh." },
    ],
  },
  {
    version: "0.31.0",
    date: "2026-11-12",
    title: "Volcano and Big dunes",
    changes: [
      { kind: NEW, text: "Volcano: a lap round the crater rim above the lava, and a run of hairpins from the rim down to the sea." },
      { kind: NEW, text: "Big dunes: 120 m dunes for off-road cars, packed lines every car can climb, and crest jumps." },
      { kind: IMPROVED, text: "Mini maps sit in a picture strip under the Mainland map." },
      { kind: FIXED, text: "Online races sit out a player whose car the route leaves out, instead of starting them." },
    ],
  },
  {
    version: "0.30.2",
    date: "2026-11-12",
    title: "Map pictures",
    changes: [
      { kind: NEW, text: "Custom and saved maps show a top-down picture of their world." },
      { kind: IMPROVED, text: "The garage fits phones held upright, and short desktop windows get a smaller map and speedometer." },
      { kind: FIXED, text: "Picking the map you're on from Play keeps its Create world settings, and arrow keys stay inside the update card." },
    ],
  },
  {
    version: "0.30.1",
    date: "2026-11-12",
    title: "Level streets",
    changes: [
      { kind: FIXED, text: "Mainland town streets no longer dip where they cross other roads. Records on Island, Dune sea, Mainland, Alpine and Frozen lakes start fresh." },
      { kind: IMPROVED, text: "Island builds faster again after the steep-trail fix." },
    ],
  },
  {
    version: "0.30.0",
    date: "2026-11-12",
    title: "Smoother roads",
    changes: [
      { kind: IMPROVED, text: "Roads no longer tilt sideways near trail banks, and side roads meet the main road without steps. Records on Island, Dune sea, Mainland, Alpine and Frozen lakes start fresh." },
      { kind: IMPROVED, text: "The automatic gearbox no longer hunts between gears on climbs or drops into the limiter mid-drift." },
      { kind: IMPROVED, text: "My builds: delete asks Sure? first, and focus stays on the build you acted on." },
    ],
  },
  {
    version: "0.29.1",
    date: "2026-11-12",
    title: "What's new card",
    changes: [
      { kind: NEW, text: "After an update, a card shows what changed since the version you last played." },
      { kind: IMPROVED, text: "The game checks for updates every 15 minutes." },
      { kind: IMPROVED, text: "Create world fits phones held upright, and buttons on brand colours read clearly in light themes." },
      { kind: FIXED, text: "Mainland river mouths no longer flicker against the sea, and on phone graphics the sea is blue near the shore instead of fog grey." },
    ],
  },
  {
    version: "0.29.0",
    date: "2026-11-11",
    title: "Winter",
    changes: [
      { kind: NEW, text: "Winter: set Season to Winter in Create world for Island, Dune sea or Alpine. Snow on the ground, packed-snow roads with snowbanks, frozen lakes and low grip. Winter has its own records and map codes." },
      { kind: NEW, text: "Frozen lakes: a new mini map of white flats, frozen lakes to drift on, pine bands and small hamlets." },
      { kind: IMPROVED, text: "Drifting: a handbrake tap at full lock then full gas holds a slide you can catch with countersteer, at any speed. The slide no longer weaves or bleeds speed, and letting go of the keys straightens the car." },
      { kind: IMPROVED, text: "Steep off-road trails are graded so every car can climb them. Island records start fresh." },
      { kind: IMPROVED, text: "The mainland builds faster as you drive." },
      { kind: IMPROVED, text: "New pictures for every mini map, and roads on the world map stay readable on snow." },
      { kind: IMPROVED, text: "My builds cards show the full name, and the whole card loads the build." },
      { kind: IMPROVED, text: "Click the gear to switch between automatic and manual, and parking starts in the normal camera." },
    ],
  },
  {
    version: "0.28.1",
    date: "2026-11-11",
    title: "Update chip",
    changes: [
      { kind: NEW, text: "An update chip shows on the drive screen too: tap Update ready to restart into the new version." },
      { kind: IMPROVED, text: "The guide's tour cards have their own illustrations." },
      { kind: IMPROVED, text: "Each driving assist says what turning it on or off does, right under its name." },
      { kind: FIXED, text: "The loading screen no longer shifts, and settings fit narrow phones: choice rows wrap, and each section keeps its title." },
    ],
  },
  {
    version: "0.28.0",
    date: "2026-11-11",
    title: "Create world",
    changes: [
      { kind: NEW, text: "Create world: pick a preset, tune hills, trees, dunes, rocks, ridges, water and town size, save your maps and share them as a short code or link. Every combination builds a drivable world." },
      { kind: NEW, text: "Mainland towns have buildings, street lights and parked cars." },
      { kind: NEW, text: "New HUD: filled cards for the map and the speedometer, a clean ring gauge (or a bar gauge in Settings), four clickable assist switches, and the map in the bottom left or top right." },
      { kind: IMPROVED, text: "Drifting: full lock and full gas from a stop kicks a slide you can hold on full gas, and it keeps its speed. While rolling, tap the handbrake at full lock and floor it." },
      { kind: IMPROVED, text: "Steering: a full key turns a little tighter at speed, and fast cars build and release steering more smoothly." },
      { kind: IMPROVED, text: "Island and Alpine hairpins climb the hillside on U-turns instead of cutting into it. Records on those maps start fresh." },
      { kind: IMPROVED, text: "Mainland junctions meet at clean angles, with no overlapping asphalt or stray kerbs. Mainland records start fresh." },
      { kind: IMPROVED, text: "Camera tilt is off by default, and the chase camera no longer swings in quick weaves." },
      { kind: FIXED, text: "The sky no longer turns black far out on the mainland, and your rolled name no longer changes when you reopen the guide." },
    ],
  },
  {
    version: "0.27.0",
    date: "2026-11-11",
    title: "Grip",
    changes: [
      { kind: IMPROVED, text: "Steering grips with Steering assist off: the front tyres stay at their limit, so bends hold without sliding or scrubbing speed. Steering assist now only countersteers a slide for you." },
      { kind: IMPROVED, text: "The Balanced assist preset turns Stability on." },
      { kind: IMPROVED, text: "Traction control lets loose ground spin the wheels as much as asphalt does, so dirt and sand feel livelier." },
      { kind: FIXED, text: "The chase camera stays calm in quick left-right weaves and still follows long turns." },
    ],
  },
  {
    version: "0.26.2",
    date: "2026-11-11",
    title: "Calmer camera",
    changes: [
      { kind: FIXED, text: "The chase camera no longer leans through corners. Camera tilt keeps only the dip under braking and the lift on throttle." },
      { kind: NEW, text: "Assist presets in Settings > Assists: Easy, Balanced and Pro set all five aids in one tap." },
      { kind: IMPROVED, text: "The menu says an update is downloading as soon as you open the game, and Update ready now stands out." },
    ],
  },
  {
    version: "0.26.1",
    date: "2026-11-11",
    title: "Pad tuning",
    changes: [
      { kind: NEW, text: "Advanced controller settings in Controls: steering deadzones and response curve, throttle and brake deadzones, with a live stick preview. Defaults feel exactly as before." },
      { kind: IMPROVED, text: "ABS brakes harder on dirt and grass, matching the loose ground's grip." },
      { kind: FIXED, text: "Holding a touch arrow steers even with a gamepad connected." },
    ],
  },
  {
    version: "0.26.0",
    date: "2026-11-11",
    title: "Loose ground",
    changes: [
      { kind: NEW, text: "Controller rumble: tyres sliding, loose ground, kerbs, landings and hits. Off, Subtle or Strong in Settings, Controls." },
      { kind: IMPROVED, text: "Dirt, gravel, grass and sand slide like loose ground: less grip, and the slide builds gently so you can catch it." },
      { kind: IMPROVED, text: "Every tyre has its job: Street on tarmac, Rally on dirt and gravel, Mud on grass, sand and wet ground, All-terrain a bit of everything." },
      { kind: IMPROVED, text: "Cars level out in the air off a crest and land on their wheels instead of tumbling." },
      { kind: FIXED, text: "Slicks in deep water no longer grip like tarmac." },
    ],
  },
  {
    version: "0.25.1",
    date: "2026-11-11",
    title: "Stability",
    changes: [
      { kind: NEW, text: "Stability is its own driving aid, separate from steering assist: a Settings row, key 5 and an STM lamp on the dash. Turn it off to let slides grow; launches from rest still catch." },
    ],
  },
  {
    version: "0.25.0",
    date: "2026-11-11",
    title: "Floating HUD",
    changes: [
      { kind: NEW, text: "A new driving HUD with no panels: a round map bottom-left, a speed dial bottom-right with gear and shift light, and the event up top. Racing, Compact and Minimal layouts stay in Settings." },
      { kind: NEW, text: "Car classes: every build gets a class (D to X) and a performance rating, shown in the garage and on cars, presets and saved builds. Trying a part shows how the rating changes." },
      { kind: IMPROVED, text: "From a standstill, full lock and full gas swing a rear- or all-wheel-drive car into a slide you can catch without lifting." },
      { kind: FIXED, text: "The class badge no longer covers a car card's weight." },
    ],
  },
  {
    version: "0.24.0",
    date: "2026-11-11",
    title: "Alpine pass",
    changes: [
      { kind: NEW, text: "Alpine pass: a mini map with a mountain range, two passes, a hairpin climb and villages on the slopes." },
      { kind: NEW, text: "Mainland rivers and lakes. Drive through shallow fords; deep water puts you back on the road." },
      { kind: NEW, text: "Quit a running mode from the Play tab or the Modes page." },
      { kind: IMPROVED, text: "Calmer camera at speed: a subtle zoom by default, plus a slight dip under braking and lean in corners. Speed zoom and Camera tilt are new settings." },
      { kind: IMPROVED, text: "Smooth keyboard steering turns in faster, catches a swerve cleanly and answers short taps with small corrections." },
      { kind: IMPROVED, text: "Race gates are easier to read at speed, with arrowheads leading to the next gate." },
      { kind: IMPROVED, text: "Menu pages open faster and the game starts sooner." },
      { kind: FIXED, text: "Next level after a race no longer freezes the game." },
      { kind: FIXED, text: "Modes no longer run the free-drive lap timer, so no stray lap times or goals." },
      { kind: FIXED, text: "Gate hunt and parking clocks wait until you drive." },
      { kind: FIXED, text: "Gymkhana and parking never start on a hillside, and the car lands upright." },
      { kind: FIXED, text: "When a mode can't start, the result card says why." },
      { kind: FIXED, text: "A drift run with no points earns no stars. Gymkhana time no longer counts its penalty twice." },
      { kind: FIXED, text: "The Play tab drops Restart lap, and the You're here tag no longer covers the map name." },
    ],
  },
  {
    version: "0.23.1",
    date: "2026-11-10",
    title: "Warm earth",
    changes: [
      { kind: IMPROVED, text: "Dirt and road shoulders look like warm earth in the light themes." },
      { kind: FIXED, text: "On narrow phones the map legend no longer covers the coast." },
    ],
  },
  {
    version: "0.23.0",
    date: "2026-11-10",
    title: "Mainland",
    changes: [
      { kind: NEW, text: "Mainland: a 6 km world of towns joined by open roads, with a long circuit. It streams in around you as you drive." },
      { kind: NEW, text: "The Play tab leads with a live map of the mainland: where you are, the towns, the circuit and other players. The small worlds sit beside it as Mini maps." },
      { kind: NEW, text: "New players start on the mainland, and the open lobby meets there." },
      { kind: NEW, text: "Dune sea replaces the desert: wind-cut dune ridges, flat pans to blast across, long straights and wind pumps. Desert records start fresh." },
      { kind: IMPROVED, text: "The game starts faster, especially on phones." },
      { kind: IMPROVED, text: "Sand looks warm in the light themes instead of olive." },
      { kind: FIXED, text: "A failed start shows a clean screen with a Reload button." },
    ],
  },
  {
    version: "0.22.1",
    date: "2026-11-10",
    title: "Small fixes",
    changes: [
      { kind: FIXED, text: "Skip guide is always reachable in short desktop windows." },
    ],
  },
  {
    version: "0.22.0",
    date: "2026-11-10",
    title: "Desert",
    changes: [
      { kind: NEW, text: "Desert: a new world of dunes, mesas, a canyon and small outposts. Hardpack is quick, loose sand slides, and cacti and rocks stand in the way." },
      { kind: NEW, text: "The Play tab shows every world in one row." },
      { kind: IMPROVED, text: "Worlds load faster: the area around you is ready first and the rest streams in." },
      { kind: IMPROVED, text: "If a world ever fails to load, you get a clear message and a Reload button." },
    ],
  },
  {
    version: "0.21.0",
    date: "2026-11-10",
    title: "Rounded corners",
    changes: [
      { kind: IMPROVED, text: "Town street corners are rounded with proper curbs, and sidewalks follow them round." },
      { kind: IMPROVED, text: "Race cones sit past the junction curbs, cover the whole road and look like the other cones." },
      { kind: IMPROVED, text: "Faster collision checks while race cones are out." },
      { kind: IMPROVED, text: "Island lap records start fresh with the new town corners." },
    ],
  },
  {
    version: "0.20.0",
    date: "2026-11-10",
    title: "Races through town",
    changes: [
      { kind: NEW, text: "Street races now use the roads between towns and cross the circuit at crossroads, so there are more different races." },
      { kind: IMPROVED, text: "Cones close the side roads only while a race runs, so the island is open when you free roam." },
      { kind: IMPROVED, text: "Island lap records start fresh with the new race routes." },
    ],
  },
  {
    version: "0.19.0",
    date: "2026-11-10",
    title: "Pick a car",
    changes: [
      { kind: NEW, text: "Presets in the garage: Easy cruiser, Maxed F1, Dirt rally, Mud basher, Drift and Party bus, one tap each." },
      { kind: NEW, text: "The first-run guide lets you pick a car from the presets." },
      { kind: IMPROVED, text: "New players start in an easy, forgiving hatch that is calm on lift-off and not too fast." },
    ],
  },
  {
    version: "0.18.0",
    date: "2026-11-10",
    title: "Roads between towns",
    changes: [
      { kind: NEW, text: "The island has a road network: towns are linked by local roads that merge into trunks, branch off at T-junctions and cross the circuit at proper crossroads." },
      { kind: NEW, text: "Local roads show on the world map." },
      { kind: IMPROVED, text: "Corners where roads meet grip like road, not grass." },
      { kind: IMPROVED, text: "Island lap records start fresh with this new road layout." },
    ],
  },
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
