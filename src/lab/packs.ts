import type { Pack } from "./pack";

const ref = (id: string) => () => import("./packs/ai-ref").then((m) => ({ default: m.ref_pack(id) }));

/** `?lab=<id>`: each pack is its own chunk, so a new one adds nothing to the main bundle. */
export const PACKS: Record<string, () => Promise<{ default: Pack }>> = {
  demo: () => import("./packs/demo"),
  "ai-field": () => import("./packs/ai-field"),
  "ai-ref-0": ref("ai-ref-0"),
  "ai-ref-1": ref("ai-ref-1"),
  "ai-ref-2": ref("ai-ref-2"),
  "ai-ref-9-rev": ref("ai-ref-9-rev"),
  "ai-ref-16": ref("ai-ref-16"),
  "ai-ref-30": ref("ai-ref-30"),
  "ai-ref-h-1": ref("ai-ref-h-1"),
  "ai-ref-h-16": ref("ai-ref-h-16"),
  "ai-ref-h-30": ref("ai-ref-h-30"),
  "first-look": () => import("./packs/first-look"),
  "t1a-pads": () => import("./packs/t1a-pads"),
  "t1b-brakes": () => import("./packs/t1b-brakes"),
  "t2-drift": () => import("./packs/t2-drift"),
  "t3a-sturm-power": () => import("./packs/t3a-sturm-power"),
  "t3b-sturm-grip": () => import("./packs/t3b-sturm-grip"),
  "t3c-raijin": () => import("./packs/t3c-raijin"),
  "t3e-muscle": () => import("./packs/t3e-muscle"),
  "t3-r4": () => import("./packs/t3-r4"),
  "t4-sajin": () => import("./packs/t4-sajin"),
  "t5-bands": () => import("./packs/t5-bands"),
};
