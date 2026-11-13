import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { issue_link, short_agent, type IssueFields } from "./issue-link";

const FIELDS: IssueFields = { version: "0.36.0", device: "Windows, Chrome 131", input: "Keyboard", map: "island 1", graphics: "auto, high" };
const FORMS = new URL("../../.github/ISSUE_TEMPLATE/", import.meta.url);

describe("issue_link", () => {
  test("names the form and fills each field by its id", () => {
    const url = new URL(issue_link("bug.yml", FIELDS));
    expect(`${url.origin}${url.pathname}`).toBe("https://github.com/lilBunnyRabbit/harepin/issues/new");
    expect(url.searchParams.get("template")).toBe("bug.yml");
    expect(url.searchParams.get("graphics")).toBe("auto, high");
    expect(url.searchParams.get("device")).toBe("Windows, Chrome 131");
  });

  test("every form has an input for each prefilled field", () => {
    const forms = readdirSync(FORMS).filter((name) => name !== "config.yml");
    expect(forms.length).toBeGreaterThan(0);
    for (const name of forms) {
      const text = readFileSync(new URL(name, FORMS), "utf8");
      for (const id of Object.keys(FIELDS)) expect(text).toMatch(new RegExp(`^ +id: ${id}\\r?$`, "m"));
    }
  });
});

describe("short_agent", () => {
  test.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "Windows, Chrome 131"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0", "Windows, Edge 131"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15", "macOS, Safari 18"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1", "iOS, Safari 18"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36", "Android, Chrome 131"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0", "Linux, Firefox 133"],
  ])("%s", (agent, short) => {
    expect(short_agent(agent)).toBe(short);
  });

  test("a Mac with a touch screen is an iPad asking for desktop sites", () => {
    const agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
    expect(short_agent(agent, 5)).toBe("iPadOS, Safari 18");
    expect(short_agent(agent, 0)).toBe("macOS, Safari 18");
  });
});
