import { chromium, type Page } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build, createServer, preview } from "vite";

// `node --experimental-strip-types scripts/car-view.ts <block.txt | -> [--out <dir>] [--screen desktop|phone] [--ui]
// [--port N]`: one PNG per note of a `?cars` export block (docs/cars.md), at the exact view the note was written at,
// its pin drawn. `--ui` keeps the panel and toolbar; without --port it builds and serves its own preview.
const ROOT = resolve(import.meta.dirname, "..");
const PORT = 5398;
const READY_MS = 60_000;
const SCREENS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;
type Screen = keyof typeof SCREENS;

interface ReadNote {
  text: string;
  n: number | null;
  view: { car: string; preset: string };
}

const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? (args[at + 1] ?? null) : null;
};
const source = args[0];
if (!source || source.startsWith("--")) throw new Error("car-view: give an export block file, or - for stdin");
const screen = (option("screen") ?? "desktop") as Screen;
if (!(screen in SCREENS)) throw new Error(`--screen takes ${Object.keys(SCREENS).join("|")}`);
const ui = args.includes("--ui");
const out = resolve(option("out") ?? join(tmpdir(), `harepin-cars-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`));
const given_port = option("port");

const text = source === "-" ? await stdin() : await readFile(source, "utf8");
const { notes, queries } = await read(text);
if (!notes.length) throw new Error("car-view: no notes in that block");

await mkdir(out, { recursive: true });
let server: Awaited<ReturnType<typeof preview>> | null = null;
const port = given_port === null ? PORT : Number(given_port);
if (given_port === null) {
  const out_dir = join(ROOT, "node_modules", ".car-view-dist");
  await build({ root: ROOT, logLevel: "warn", build: { outDir: out_dir, emptyOutDir: true } });
  server = await preview({ root: ROOT, build: { outDir: out_dir }, preview: { port, strictPort: true }, logLevel: "warn" });
}
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const lines: string[] = [];
try {
  const context = await browser.newContext({ ...SCREENS[screen], serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.warn(`page: ${error.message}`));
  for (const [i, note] of notes.entries()) {
    const name = `${String(i + 1).padStart(2, "0")}-${note.view.car}-${note.view.preset}-${note.n === null ? "note" : `pin${note.n}`}.png`;
    await page.goto(`http://localhost:${port}/${queries[i]}`);
    await ready(page);
    await page.screenshot({ path: join(out, name) });
    lines.push(`${name}\t${JSON.stringify(note.text)}`);
  }
  await context.close();
} finally {
  await browser.close();
  await server?.close();
}
await writeFile(join(out, "notes.txt"), `${lines.join("\n")}\n`);
console.log(`${notes.length} shots: ${out}`);

// Through Vite, which resolves the source's extensionless imports: the block is read by the same code that wrote it.
async function read(block: string): Promise<{ notes: ReadNote[]; queries: string[] }> {
  const vite = await createServer({ root: ROOT, logLevel: "warn", server: { middlewareMode: true }, appType: "custom" });
  try {
    const { read_block, note_query } = await vite.ssrLoadModule("/src/viewer/export.ts");
    const notes: ReadNote[] = read_block(block);
    return { notes, queries: notes.map((note) => note_query(note, !ui)) };
  } finally {
    await vite.close();
  }
}

// A link in the other light reloads once into its theme, so the mark is read off whatever page is current.
async function ready(page: Page) {
  const until = Date.now() + READY_MS;
  while (Date.now() < until) {
    const state = await page.evaluate(() => document.documentElement.dataset.cars ?? "").catch(() => "");
    if (state === "ready") return;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`${page.url()}: not ready after ${READY_MS / 1000} s`);
}

async function stdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}
