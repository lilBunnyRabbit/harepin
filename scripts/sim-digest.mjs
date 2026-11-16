import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, webkit } from "playwright";

// Playwright does not launch browsers under Bun on Windows, so this runs on Node and bundles with `bun build`.
const ROOT = resolve(import.meta.dirname, "..");
const bundle = join(mkdtempSync(join(tmpdir(), "sim-digest-")), "sim-digest.js");
execFileSync("bun", ["build", join(ROOT, "src/car/sim-digest.ts"), "--target", "browser", "--format", "esm", "--outfile", bundle], { stdio: "ignore", shell: true });
const runner = join(dirname(bundle), "run.mjs");
writeFileSync(runner, `import { car_digest, maths_digest } from "./sim-digest.js";
console.log(JSON.stringify({ maths: maths_digest(), car: car_digest() }));
`);
const source = readFileSync(bundle, "utf8");
const line = (name, got) => `${name.padEnd(8)} maths ${got.maths}  car ${got.car}`;

const bun = execFileSync("bun", [runner], { encoding: "utf8", shell: true });
const want = JSON.parse(bun);
const results = [["bun " + execFileSync("bun", ["--version"], { encoding: "utf8", shell: true }).trim(), want]];
const mod = await import(pathToFileURL(bundle).href);
results.push([`node ${process.versions.v8}`, { maths: mod.maths_digest(), car: mod.car_digest() }]);
for (const [name, engine, options] of [["chrome", chromium, { channel: "chrome" }], ["webkit", webkit, {}]]) {
  const browser = await engine.launch(options).catch((error) => {
    console.log(`${name} skipped: ${String(error.message).split("\n")[0]}`);
    return null;
  });
  if (!browser) continue;
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    const got = await page.evaluate(async (code) => {
      const m = await import(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
      return { maths: m.maths_digest(), car: m.car_digest(), agent: navigator.userAgent.match(/(Chrome|Version)\/[\d.]+/)?.[0] ?? "" };
    }, source);
    results.push([`${name} ${got.agent}`, got]);
  } finally {
    await browser.close();
  }
}
for (const [name, got] of results) console.log(line(name, got));
if (results.some(([, got]) => got.maths !== want.maths || got.car !== want.car)) process.exitCode = 1;
