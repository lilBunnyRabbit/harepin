import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build, createServer, preview } from "vite";

// `node --experimental-strip-types scripts/shots.ts [--only cars|worlds|motion] [--diff <old dir>] [--out <dir>]
// [--maps <code,…>] [--replays <id,…>] [--port N]`: the visual review kit (docs/plan/visual-review.md). Node, since
// Playwright's browser pipe hangs under Bun. Every shot runs on Playwright's paused clock, stepped a frame at a time, so
// the same build gives the same pictures; without --port it builds and serves its own preview.
const ROOT = resolve(import.meta.dirname, "..");
const FRAME_MS = 1000 / 60;
const STEP_FRAMES = 4;
const SHOT_LIMIT_MS = 120_000;
const PORT = 5397;
const REPLAY_SHARES = [0.15, 0.4, 0.65, 0.9];
/** A channel this far apart counts a pixel as changed: PNG is lossless, so only real rendering drift crosses it. */
const DIFF_STEP = 8;
const THEMES = { day: "Brand Light", dusk: "Brand Dark" } as const;
type Theme = keyof typeof THEMES;
const SCREENS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;
type Screen = keyof typeof SCREENS;
const GROUPS = ["cars", "worlds", "motion"] as const;
type Group = (typeof GROUPS)[number];

interface Catalog {
  sheets: readonly string[];
  views: readonly string[];
  maps: string[];
  replays: { id: string; ghost: string }[];
  stride: number;
}

interface Shot {
  group: Group;
  section: string;
  caption: string;
  file: string;
}

const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? null) : null;
};
const list = (name: string) => option(name)?.split(",").filter(Boolean) ?? null;
const only = option("only");
if (only !== null && !GROUPS.some((group) => group === only)) throw new Error(`--only takes ${GROUPS.join("|")}`);
const groups = GROUPS.filter((group) => only === null || group === only);
const out = resolve(option("out") ?? join(tmpdir(), `harepin-shots-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`));
const old_dir = option("diff");
const given_port = option("port");

const catalog = await read_catalog();
const maps = list("maps") ?? catalog.maps;
const replays = catalog.replays.filter((replay) => list("replays")?.includes(replay.id) ?? true);

const started = performance.now();
await mkdir(out, { recursive: true });
let server: Awaited<ReturnType<typeof preview>> | null = null;
let port = given_port === null ? PORT : Number(given_port);
if (given_port === null) {
  const out_dir = join(ROOT, "node_modules", ".shots-dist");
  await build({ root: ROOT, logLevel: "warn", build: { outDir: out_dir, emptyOutDir: true } });
  server = await preview({ root: ROOT, build: { outDir: out_dir }, preview: { port, strictPort: true }, logLevel: "warn" });
  port = PORT;
}
const base = `http://localhost:${port}/`;
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const shots: Shot[] = [];
const problems: string[] = [];
try {
  for (const screen of Object.keys(SCREENS) as Screen[])
    for (const theme of Object.keys(THEMES) as Theme[]) {
      const context = await open_context(browser, screen);
      const tag = `${screen}-${theme}`;
      if (groups.includes("cars")) for (const sheet of catalog.sheets) await shoot_sheet(context, sheet, theme, tag);
      if (groups.includes("worlds")) for (const map of maps) await shoot_world(context, map, theme, tag);
      if (groups.includes("motion")) for (const replay of replays) await shoot_replay(context, replay, theme, tag);
      await context.close();
    }
  const diffs = old_dir ? await diff(browser, resolve(old_dir)) : null;
  await writeFile(join(out, "index.html"), contact_sheet(diffs));
} finally {
  await browser.close();
  await server?.close();
}
const seconds = (performance.now() - started) / 1000;
for (const problem of problems) console.warn(problem);
console.log(`${shots.length} shots in ${seconds.toFixed(0)} s: ${join(out, "index.html")}`);

// From the source through Vite, which resolves its extensionless imports: one list of sheets, views, maps and replays.
async function read_catalog(): Promise<Catalog> {
  const vite = await createServer({ root: ROOT, logLevel: "warn", server: { middlewareMode: true }, appType: "custom" });
  try {
    const { catalog } = await vite.ssrLoadModule("/src/review/catalog.ts");
    const { STRIDE } = await vite.ssrLoadModule("/src/car/ghost-cap.ts");
    return { ...catalog(), stride: STRIDE };
  } finally {
    await vite.close();
  }
}

async function open_context(browser: Browser, screen: Screen): Promise<BrowserContext> {
  const context = await browser.newContext({ ...SCREENS[screen], serviceWorkers: "block" });
  // The dusk stars and tyre smoke draw from Math.random: one seed for every page keeps them where they were last run.
  await context.addInitScript(() => {
    let seed = 1;
    Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  });
  // Only the preview and the web font load: no analytics, nothing a run's timing could change.
  await context.route(/^https?:\/\//, (route) => {
    const url = route.request().url();
    if (url.startsWith(base) || /fonts\.(googleapis|gstatic)\.com/.test(url)) return route.continue();
    return route.abort();
  });
  return context;
}

async function page_of(context: BrowserContext, label: string, clock: boolean): Promise<Page> {
  const page = await context.newPage();
  page.on("pageerror", (error) => problems.push(`${label}: ${error.message}`));
  if (clock) await page.clock.install({ time: new Date("2026-06-21T12:00:00Z") });
  return page;
}

function review_state(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.dataset.review ?? "");
}

/** Steps the paused clock until `<html data-review>` reads `key`; false when the page says it has no such shot. */
async function settle(page: Page, key: string, clock: boolean): Promise<boolean> {
  const until = Date.now() + SHOT_LIMIT_MS;
  while (Date.now() < until) {
    const state = await review_state(page);
    if (state === key) return true;
    if (state.startsWith("missing:")) return false;
    if (clock) await page.clock.runFor(FRAME_MS * STEP_FRAMES);
    // Real time for the world worker, which the page's clock does not hold.
    await new Promise((done) => setTimeout(done, 4));
  }
  throw new Error(`${page.url()}: no "${key}" after ${SHOT_LIMIT_MS / 1000} s (at "${await review_state(page)}")`);
}

async function save(page: Page, shot: Omit<Shot, "file">, name: string, full_page = false) {
  const file = `${shot.group}/${name}.png`;
  await mkdir(join(out, shot.group), { recursive: true });
  await page.screenshot({ path: join(out, file), fullPage: full_page });
  shots.push({ ...shot, file });
}

function query(theme: Theme, extra: Record<string, string>): string {
  return `${base}?${new URLSearchParams({ theme: THEMES[theme], quality: "high", ...extra })}`;
}

async function shoot_sheet(context: BrowserContext, sheet: string, theme: Theme, tag: string) {
  const page = await page_of(context, `showcase ${sheet}`, false);
  await page.goto(query(theme, { showcase: sheet }));
  await settle(page, `sheet:${sheet}`, false);
  await save(page, { group: "cars", section: sheet, caption: tag }, `${sheet}-${tag}`, true);
  await page.close();
}

async function shoot_world(context: BrowserContext, map: string, theme: Theme, tag: string) {
  const page = await page_of(context, `map ${map}`, true);
  const [first, ...rest] = catalog.views;
  await page.goto(query(theme, { map, view: first }));
  for (const view of [first, ...rest]) {
    if (view !== first) await page.evaluate((hash) => (location.hash = hash), `view=${view}`);
    if (!(await settle(page, `view:${view}`, true))) continue;
    await save(page, { group: "worlds", section: map, caption: `${view} · ${tag}` }, `${map}-${view}-${tag}`);
  }
  await page.close();
}

async function shoot_replay(context: BrowserContext, replay: Catalog["replays"][number], theme: Theme, tag: string) {
  const ghost = join(ROOT, "public", replay.ghost);
  if (!existsSync(ghost)) {
    problems.push(`${replay.id}: no dev ghost at ${ghost}`);
    return;
  }
  const lap: number[] = JSON.parse(await readFile(ghost, "utf8"));
  const end = lap[lap.length - catalog.stride] / 1000;
  const times = REPLAY_SHARES.map((share) => Number((end * share).toFixed(1)));
  const page = await page_of(context, `replay ${replay.id}`, true);
  await page.goto(query(theme, { replay: replay.id, t: String(times[0]), car: "coupe" }));
  for (const t of times) {
    if (t !== times[0]) await page.evaluate((hash) => (location.hash = hash), `t=${t}`);
    if (!(await settle(page, `t:${t}`, true))) break;
    await save(page, { group: "motion", section: replay.id, caption: `${t} s · ${tag}` }, `${replay.id}-${String(t).replace(".", "_")}s-${tag}`);
  }
  await page.close();
}

interface Diff {
  file: string;
  /** Share of pixels changed, 0-1; null when the old run has no such shot or its size changed. */
  changed: number | null;
}

async function diff(browser: Browser, old: string): Promise<Diff[]> {
  const page = await browser.newPage();
  const result: Diff[] = [];
  for (const shot of shots) {
    const before = join(old, shot.file);
    if (!existsSync(before)) {
      result.push({ file: shot.file, changed: null });
      continue;
    }
    const [a, b] = await Promise.all([readFile(before), readFile(join(out, shot.file))]);
    const changed = await page.evaluate(
      async ([a, b, step]) => {
        const pixels = async (b64: string) => {
          const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
          const canvas = new OffscreenCanvas(image.width, image.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("diff: no 2d canvas");
          ctx.drawImage(image, 0, 0);
          return ctx.getImageData(0, 0, image.width, image.height);
        };
        const [x, y] = await Promise.all([pixels(a), pixels(b)]);
        if (x.width !== y.width || x.height !== y.height) return null;
        let count = 0;
        for (let i = 0; i < x.data.length; i += 4)
          if (Math.abs(x.data[i] - y.data[i]) > step || Math.abs(x.data[i + 1] - y.data[i + 1]) > step || Math.abs(x.data[i + 2] - y.data[i + 2]) > step) count++;
        return count / (x.width * x.height);
      },
      [a.toString("base64"), b.toString("base64"), DIFF_STEP] as const,
    );
    result.push({ file: shot.file, changed });
  }
  await page.close();
  const listed = result.filter((d) => d.changed !== 0).sort((x, y) => (y.changed ?? 2) - (x.changed ?? 2));
  const lines = listed.map((d) => `${d.changed === null ? "new/resized" : `${(d.changed * 100).toFixed(2)}%`}\t${d.file}`);
  await writeFile(join(out, "diff.txt"), `${lines.join("\n")}\n`);
  console.log(`diff against ${old}: ${listed.length} of ${result.length} shots changed${lines.length ? `\n${lines.join("\n")}` : ""}`);
  const gone = (await files_under(old)).filter((file) => !shots.some((shot) => shot.file === file));
  for (const file of gone) console.log(`missing now\t${file}`);
  return listed;
}

async function files_under(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const group of GROUPS) {
    const sub = join(dir, group);
    if (existsSync(sub)) for (const name of await readdir(sub)) if (name.endsWith(".png")) found.push(`${group}/${name}`);
  }
  return found;
}

function escape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

function contact_sheet(diffs: Diff[] | null): string {
  const parts: string[] = [];
  if (diffs) {
    const rows = diffs.map((d) => `<li><a href="${escape(d.file)}">${escape(d.file)}</a> ${d.changed === null ? "new or resized" : `${(d.changed * 100).toFixed(2)}%`}</li>`);
    parts.push(`<section><h2>Changed since ${escape(old_dir ?? "")}</h2>${rows.length ? `<ol>${rows.join("")}</ol>` : "<p>Nothing changed.</p>"}</section>`);
  }
  for (const group of groups) {
    const here = shots.filter((shot) => shot.group === group);
    const sections = [...new Set(here.map((shot) => shot.section))];
    parts.push(`<h1>${group}</h1>`);
    for (const section of sections) {
      const figures = here
        .filter((shot) => shot.section === section)
        .map((shot) => `<figure><a href="${escape(shot.file)}"><img loading="lazy" src="${escape(shot.file)}" alt=""></a><figcaption>${escape(shot.caption)}</figcaption></figure>`);
      parts.push(`<section><h2>${escape(section)}</h2><div class="grid${group === "cars" ? " wide" : ""}">${figures.join("")}</div></section>`);
    }
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Harepin shots</title><style>
body{margin:0;padding:16px;font:14px system-ui,sans-serif;background:#16181a;color:#e8e6e3}
h1{text-transform:capitalize;margin:32px 0 8px}h2{font-size:15px;margin:20px 0 8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}.grid.wide{grid-template-columns:repeat(auto-fill,minmax(480px,1fr))}
figure{margin:0}img{display:block;width:100%;height:auto;border-radius:4px}figcaption{opacity:.7;margin-top:4px}a{color:inherit}
</style></head><body><p>${shots.length} shots, ${new Date().toISOString()}</p>${parts.join("\n")}</body></html>\n`;
}
