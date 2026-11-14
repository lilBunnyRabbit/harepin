export interface Preset {
  name: string;
  blurb: string;
  code: string;
}

// The first one is DEFAULT_BUILD, a new player's car: presets.test.ts holds them to each other.
export const PRESETS: readonly Preset[] = [
  { name: "Easy cruiser", blurb: "Front-drive hatch with a wing: calm and forgiving", code: "hatch.4.0.2.1.0" },
  { name: "Maxed F1", blurb: "Formula with every top part and the race kit", code: "formula.6.4.4.2.2.0.1.2.2.2.1.2" },
  { name: "Dirt rally", blurb: "Rally car on rally tyres and lifted springs", code: "rally.4.2.0.4.1.0.7.3" },
  { name: "Mud basher", blurb: "AWD Raijin on mud tyres, lifted, best on grass", code: "raijin.2.3.0.4.1.0.7.5" },
  { name: "Drift", blurb: "Rear-drive Muscle, drift suspension, rear brake bias. With assists off, a launch from rest spins into a donut", code: "muscle.1.5.0.3.1.0.7.0.0.0.2" },
  { name: "Tsumuji", blurb: "Light rear-drive hardtop on drift suspension: lift off to swing it in, carry the speed through", code: "tsumuji.4.2.3.3.0.0.86.0.0.1.2" },
  { name: "Fujin prototype", blurb: "The Legend reward: hybrid prototype with every top part and the race kit", code: "fujin.6.4.4.2.2.0.1.2.2.2.1.2" },
  { name: "Sajin", blurb: "Sand buggy with the race kit: light bar, nerf bars and a spare. Best on sand, dirt and grass", code: "sajin.4.0.4.1.0" },
  { name: "Party bus", blurb: "The bus with a race engine and a big nitro tank", code: "bus.3.0.0.1.2.0.7.0.1.0.1.2" },
];
