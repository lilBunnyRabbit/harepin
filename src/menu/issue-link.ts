export const ISSUES_URL = "https://github.com/lilBunnyRabbit/harepin/issues/new";

/** Field ids shared by every form in `.github/ISSUE_TEMPLATE`; GitHub fills a form field from the query param of its id. */
export interface IssueFields {
  version: string;
  device: string;
  input: string;
  map: string;
  graphics: string;
}

const OS: [RegExp, string][] = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X/, "macOS"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];

// Order matters: Edge, Opera and Samsung also say Chrome, and Chrome also says Safari.
const BROWSERS: [RegExp, string][] = [
  [/Edg(?:A|iOS)?\/(\d+)/, "Edge"],
  [/OPR\/(\d+)/, "Opera"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"],
  [/Version\/(\d+).*Safari/, "Safari"],
];

/** iPadOS asks for desktop sites and reports itself as a Mac; only the touch points give it away. */
export function short_agent(agent: string, touch_points = 0): string {
  let os = OS.find(([test]) => test.test(agent))?.[1] ?? "Unknown OS";
  if (os === "macOS" && touch_points > 1) os = "iPadOS";
  for (const [test, name] of BROWSERS) {
    const found = agent.match(test);
    if (found) return `${os}, ${name} ${found[1]}`;
  }
  return `${os}, unknown browser`;
}

export function issue_link(template: string, fields: IssueFields): string {
  return `${ISSUES_URL}?${new URLSearchParams({ template, ...fields })}`;
}
