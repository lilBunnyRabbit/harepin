import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const source = new URL("./og.html", import.meta.url);
const target = fileURLToPath(new URL("../../public/og.jpg", import.meta.url));

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(source.href);
await page.evaluate("document.fonts.ready");
await page.screenshot({ path: target, type: "jpeg", quality: 90 });
await browser.close();
console.log(`wrote ${target}`);
