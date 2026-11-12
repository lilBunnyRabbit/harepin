import { chromium, type Page } from "playwright";
import { writeFile } from "node:fs/promises";
import { build, preview } from "vite";
import type { WorldKind } from "../src/worldgen/types";

// `node --experimental-strip-types scripts/menu-shots.ts [kind…] [--port N]`: Node, since Playwright's browser pipe
// hangs under Bun on Windows. Without --port it builds and serves its own preview, so a tree others are editing never
// changes what a run shows halfway through.
const SEED = 1;
const TILE = { width: 1600, height: 900 };
const MAP_SIDE = 800;
const MAX_BYTES = 90_000;
const QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5];
const SETTLE_MS = 5000;
const OUT = new URL("../public/menu/", import.meta.url);

interface Spot {
  /** Road index the car starts on; omitted, the regular spawn. */
  at?: number;
  orbit?: [number, number];
}

// A kind missing here gets no pictures from a bare run; name it on the command line to shoot it at its spawn.
const SPOTS: Partial<Record<WorldKind, Spot>> = {
  island: {},
  sky: {},
  desert: {},
  mainland: {},
  alpine: { at: 1895 },
  tundra: {},
  volcano: {},
  dunes: {},
};

const args = process.argv.slice(2);
const port_at = args.indexOf("--port");
const given_port = port_at >= 0 ? Number(args[port_at + 1]) : null;
const named = args.filter((a, i) => !a.startsWith("--") && (port_at < 0 || i !== port_at + 1)) as WorldKind[];
const kinds = named.length ? named : (Object.keys(SPOTS) as WorldKind[]);

let server: Awaited<ReturnType<typeof preview>> | null = null;
let port = given_port;
if (port === null) {
  await build({ logLevel: "warn" });
  server = await preview({ preview: { port: 5398, strictPort: true }, logLevel: "warn" });
  port = 5398;
}
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
try {
  for (const kind of kinds) await shoot(kind, SPOTS[kind] ?? {});
} finally {
  await browser.close();
  await server?.close();
}

async function shoot(kind: WorldKind, spot: Spot) {
  const page = await browser.newPage({ viewport: TILE });
  page.on("pageerror", (error) => console.warn(`${kind}: ${error.message}`));
  const query = new URLSearchParams({ room: "menu-shots", seed: String(SEED), world: kind, quality: "high" });
  if (spot.at !== undefined) {
    query.set("debug", "");
    query.set("at", String(spot.at));
  }
  await page.goto(`http://localhost:${port}/?${query}`);
  await page.locator("#loading").waitFor({ state: "detached", timeout: 60_000 });
  const skip = page.getByText("Skip guide");
  if (await skip.isVisible().catch(() => false)) await skip.click();
  if (await page.locator(".settings").isVisible().catch(() => false)) await page.keyboard.press("Escape");
  const hide = await page.addStyleTag({ content: "body *{visibility:hidden!important} #app,#app canvas{visibility:visible!important}" });
  await page.waitForTimeout(SETTLE_MS);
  // The chase camera eases back behind the car once a drag ends, so an orbit shot is taken with the button still held.
  if (spot.orbit) await orbit(page, spot.orbit);
  await save(page, await page.screenshot(), `${kind}.webp`);
  if (spot.orbit) await page.mouse.up();
  await hide.evaluate((tag) => (tag as Element).remove());

  await page.setViewportSize({ width: MAP_SIDE + 1000, height: MAP_SIDE + 300 });
  await page.addStyleTag({ content: `.map-preview .world-map{width:${MAP_SIDE}px!important;height:${MAP_SIDE}px!important;max-width:none!important;max-height:none!important} .world-map-cars,#debug{display:none!important}` });
  await page.keyboard.press("Escape");
  await page.getByText("Create world").first().click();
  const map = page.locator(".map-preview .world-map");
  await map.and(page.locator('[data-status="ready"]')).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(500);
  await save(page, await map.screenshot(), `${kind}-map.webp`);
  await page.close();
}

async function orbit(page: Page, [dx, dy]: [number, number]) {
  const x = TILE.width / 2;
  const y = TILE.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(x + (dx * i) / 20, y + (dy * i) / 20);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(1500);
}

// Chrome encodes the webp, so the script needs no image library: the highest quality that fits MAX_BYTES wins.
async function save(page: Page, png: Buffer, name: string) {
  const sizes: string[] = [];
  for (const quality of QUALITIES) {
    const webp = await page.evaluate(
      async ([b64, q]) => {
        const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const canvas = new OffscreenCanvas(image.width, image.height);
        canvas.getContext("2d")?.drawImage(image, 0, 0);
        const blob = await canvas.convertToBlob({ type: "image/webp", quality: q });
        return btoa(Array.from(new Uint8Array(await blob.arrayBuffer()), (b) => String.fromCharCode(b)).join(""));
      },
      [png.toString("base64"), quality] as const,
    );
    const bytes = Buffer.from(webp, "base64");
    sizes.push(`${quality}: ${(bytes.length / 1000).toFixed(0)} KB`);
    if (bytes.length <= MAX_BYTES || quality === QUALITIES.at(-1)) {
      await writeFile(new URL(name, OUT), bytes);
      console.log(`wrote public/menu/${name} (${sizes.join(", ")})`);
      return;
    }
  }
}
