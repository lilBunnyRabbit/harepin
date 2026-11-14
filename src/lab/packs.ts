import type { Pack } from "./pack";

/** `?lab=<id>`: each pack is its own chunk, so a new one adds nothing to the main bundle. */
export const PACKS: Record<string, () => Promise<{ default: Pack }>> = {
  demo: () => import("./packs/demo"),
  "first-look": () => import("./packs/first-look"),
  "t1a-pads": () => import("./packs/t1a-pads"),
  "t1b-brakes": () => import("./packs/t1b-brakes"),
  "t2-drift": () => import("./packs/t2-drift"),
  "t3-top-tier": () => import("./packs/t3-top-tier"),
};
