import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const PORT = process.argv[2] ?? "5299";
// Sturm, every slot at its top part (race kit aero, semi-slicks, big nitro), accent paint, rabbit decal in dark ink.
const BUILD = "sturm.2.8.4.2.2.1.7.2.2.2.1.2";
const ORBIT_DX = -420;
const ORBIT_DY = -40;
const target = fileURLToPath(new URL("./hero.jpg", import.meta.url));

const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${PORT}/?car=${BUILD}`);
await page.waitForTimeout(7000);
const skip = page.getByText("Skip guide");
if (await skip.isVisible().catch(() => false)) await skip.click();
await page.waitForTimeout(1500);
await page.keyboard.press("Escape");
await page.addStyleTag({ content: "body *{visibility:hidden!important} #app,#app canvas{visibility:visible!important}" });
await page.waitForTimeout(300);
// The chase camera eases back behind the car once the drag ends, so the shot is taken with the button still held.
await page.mouse.move(600, 315);
await page.mouse.down();
for (let i = 1; i <= 20; i++) {
  await page.mouse.move(600 + (ORBIT_DX * i) / 20, 315 + (ORBIT_DY * i) / 20);
  await page.waitForTimeout(30);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: target, type: "jpeg", quality: 92 });
await page.mouse.up();
await browser.close();
console.log(`wrote ${target}`);
