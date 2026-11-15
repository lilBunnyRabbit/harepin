import { chromium, type Page } from "playwright";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { build, preview } from "vite";
import { execFileSync } from "node:child_process";

// `node --experimental-strip-types scripts/series-art.ts [season or event id…] [--port N]`: each series event's card art,
// shot from its own race a few seconds after the lights on a review build, HUD hidden. Bare, it shoots only events
// with no picture yet. Node, since Playwright's browser pipe hangs under Bun on Windows.
const TILE = { width: 1200, height: 675 };
const MAX_BYTES = 24_000;
const QUALITIES = [0.7, 0.6, 0.5, 0.4];
const AFTER_LIGHTS_MS = 14_000;
const PORT = 5412;
const OUT = new URL("../public/series/", import.meta.url);

const args = process.argv.slice(2);
const port_at = args.indexOf("--port");
const given_port = port_at >= 0 ? Number(args[port_at + 1]) : null;
const named = args.filter((a, i) => !a.startsWith("--") && (port_at < 0 || i !== port_at + 1));
interface Event {
  id: string;
  seed: number;
}
interface Season {
  id: string;
  world: string;
  events: Event[];
}
// The seasons are TypeScript with extensionless imports, which Node's type stripping can't follow: Bun reads them. The
// expression has no space, quote pair or `>` because Windows hands the shim to cmd.
const LIST = "JSON.stringify((await(import('./src/career/series-seasons'))).SEASONS)";
const SEASONS: Season[] = JSON.parse(execFileSync("bun", ["--print", LIST], { encoding: "utf8", shell: true }));
const events = SEASONS.flatMap((season) =>
  season.events.filter((e) => (named.length ? named.includes(e.id) || named.includes(season.id) : !existsSync(new URL(`${e.id}.webp`, OUT)))).map((event) => ({ season, event })),
);

let server: Awaited<ReturnType<typeof preview>> | null = null;
let port = given_port;
if (port === null) {
  await build({ mode: "review", logLevel: "warn" });
  server = await preview({ mode: "review", preview: { port: PORT, strictPort: true }, logLevel: "warn" });
  port = PORT;
}
const base = `http://localhost:${port}`;
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
try {
  for (const { season, event } of events) {
    const context = await browser.newContext({ viewport: TILE, serviceWorkers: "block", colorScheme: "dark" });
    await context.route(/^https?:\/\//, (route) => (route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort()));
    const page = await context.newPage();
    page.on("pageerror", (error) => console.warn(`${event.id}: ${error.message}`));
    await open_seasons(page, SEASONS.slice(0, SEASONS.indexOf(season)).map((s) => s.id), season);
    const query = new URLSearchParams({ series: event.id, seed: String(event.seed), world: season.world, aidrive: "", quality: "high" });
    await page.goto(`${base}/?${query}`);
    await page.waitForSelector("#race-lights:not([hidden])", { timeout: 180_000 }).catch(async (error: unknown) => {
      await page.screenshot({ path: `series-art-${event.id}.png` });
      throw error;
    });
    await page.addStyleTag({ content: "body *{visibility:hidden!important} #app,#app canvas{visibility:visible!important}" });
    await page.waitForTimeout(AFTER_LIGHTS_MS);
    await save(page, await page.screenshot(), `${event.id}.webp`);
    await context.close();
  }
} finally {
  await browser.close();
  await server?.close();
}

/**
 * Marks the seasons before as finished once and gives every event of this one a third place, so the season and each of
 * its events are open with cars on the grid ahead; the game creates the database first.
 */
async function open_seasons(page: Page, ids: readonly string[], season: Season) {
  const won = { season: season.id, round: 0, results: Object.fromEntries(season.events.map((e) => [e.id, { order: [0, 1, 6, 2, 3, 4, 5], bonus: [] }])) };
  await page.goto(`${base}/?series`);
  await page.waitForSelector("[data-series]", { timeout: 120_000 });
  await page.evaluate(
    ([done, own]) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("harepin");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const tx = request.result.transaction("series", "readwrite");
          for (const season of done) tx.objectStore("series").put({ season, round: 1, results: {} });
          tx.objectStore("series").put(own);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    [[...ids], won] as const,
  );
}

// Chrome encodes the webp, so the script needs no image library: the highest quality that fits MAX_BYTES wins.
async function save(page: Page, png: Buffer, name: string) {
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
    if (bytes.length <= MAX_BYTES || quality === QUALITIES.at(-1)) {
      await writeFile(new URL(name, OUT), bytes);
      console.log(`wrote public/series/${name} (${(bytes.length / 1000).toFixed(0)} KB at ${quality})`);
      return;
    }
  }
}
