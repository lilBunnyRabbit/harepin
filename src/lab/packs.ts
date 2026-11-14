import type { Pack } from "./pack";

/** `?lab=<id>`: each pack is its own chunk, so a new one adds nothing to the main bundle. */
export const PACKS: Record<string, () => Promise<{ default: Pack }>> = {
  demo: () => import("./packs/demo"),
  "first-look": () => import("./packs/first-look"),
  "t1a-pads": () => import("./packs/t1a-pads"),
  "t1b-brakes": () => import("./packs/t1b-brakes"),
  "t2-drift": () => import("./packs/t2-drift"),
  "t3a-sturm-power": () => import("./packs/t3a-sturm-power"),
  "t3b-sturm-grip": () => import("./packs/t3b-sturm-grip"),
  "t3c-raijin": () => import("./packs/t3c-raijin"),
  "t3d-kaze": () => import("./packs/t3d-kaze"),
  "t3e-muscle": () => import("./packs/t3e-muscle"),
  "t4-sajin": () => import("./packs/t4-sajin"),
};
