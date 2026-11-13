import type { Pack } from "./pack";

/** `?lab=<id>`: each pack is its own chunk, so a new one adds nothing to the main bundle. */
export const PACKS: Record<string, () => Promise<{ default: Pack }>> = {
  demo: () => import("./packs/demo"),
  "first-look": () => import("./packs/first-look"),
};
