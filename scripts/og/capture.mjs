import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const PORT = process.argv[2] ?? "5299";
// Sturm, every slot at its top part (race kit aero, semi-slicks, big nitro), accent paint, rabbit decal in dark ink.
const BUILD = "sturm.2.8.4.2.2.1.7.2.2.2.1.2";
// The pose is in world metres: a Mainland version bump moves Renpin's market street, so it needs finding again (README.md).
const SHOT = { seed: "1", world: "mainland", at: "5536", pose: "1630.58,50.53,1052.23,1632.91,51.33,1061.64" };
const SETTLE_MS = 5000;
const target = fileURLToPath(new URL("./hero.jpg", import.meta.url));

const query = new URLSearchParams({ room: "og-card", seed: SHOT.seed, world: SHOT.world, quality: "high", car: BUILD, debug: "", at: SHOT.at, pose: SHOT.pose });
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${PORT}/?${query}`);
await page.locator("#loading").waitFor({ state: "detached", timeout: 90_000 });
const skip = page.getByText("Skip guide");
if (await skip.isVisible().catch(() => false)) await skip.click();
if (await page.locator(".settings").isVisible().catch(() => false)) await page.keyboard.press("Escape");
await page.addStyleTag({ content: "body *{visibility:hidden!important} #app,#app canvas{visibility:visible!important}" });
await page.waitForTimeout(SETTLE_MS);
await page.screenshot({ path: target, type: "jpeg", quality: 92 });
await browser.close();
console.log(`wrote ${target}`);
