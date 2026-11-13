import { el, icon } from "./setting-rows";
import { DEVICES, detect_device } from "./guide";
import { MenuTab, type Menu, type MenuPage } from "./page";
import { QualityMode } from "./prefs";
import { issue_link, short_agent, type IssueFields } from "./issue-link";
import "./support.css";

interface IssueKind {
  template: string;
  icon: string;
  title: string;
  note: string;
}

const KINDS: readonly IssueKind[] = [
  { template: "bug.yml", icon: "icon-bug", title: "Report a bug", note: "Something broke, glitched or doesn't work" },
  { template: "feel.yml", icon: "icon-car", title: "Driving feel", note: "Handling, grip, steering, drifts, the camera" },
  { template: "maps.yml", icon: "icon-globe", title: "Maps and worlds", note: "Roads, terrain, spawns, a spot that looks wrong" },
  { template: "performance.yml", icon: "icon-gauge", title: "Performance", note: "Low frame rate, stutter, long loads" },
  { template: "idea.yml", icon: "icon-idea", title: "Idea or improvement", note: "Something you'd like added or changed" },
];

const FIELD_LABELS: [keyof IssueFields, string][] = [
  ["version", "Version"],
  ["device", "Device"],
  ["input", "Input"],
  ["map", "Map"],
  ["graphics", "Graphics"],
];

export class SupportPage implements MenuPage {
  readonly id = MenuTab.SUPPORT;
  readonly label = "Support";

  constructor(private readonly menu: Menu) {}

  private readonly device = short_agent(navigator.userAgent, navigator.maxTouchPoints);

  private fields(): IssueFields {
    const { host } = this.menu;
    const device = detect_device();
    const tier = host.quality_status().tier;
    return {
      version: host.version,
      device: this.device,
      input: DEVICES.find(([id]) => id === device)?.[1] ?? device,
      map: host.code ?? `${host.kind} ${host.seed}`,
      graphics: this.menu.state().quality === QualityMode.AUTO ? `auto, ${tier}` : tier,
    };
  }

  build(): HTMLElement[] {
    const about = el("div", "support-about");
    const note = el("p", "support-note");
    note.textContent =
      "I'm still tuning how the cars feel, how fast it runs and how the worlds get built, so things will change and some will break. If something feels off, tell me. I read every report.";
    const facts = el("dl", "support-facts");
    const values = new Map<keyof IssueFields, HTMLElement>();
    for (const [key, label] of FIELD_LABELS) {
      const value = el("dd");
      values.set(key, value);
      facts.append(el("dt", "", label), value);
    }
    about.append(
      el("span", "menu-eyebrow", "Work in progress"),
      el("h3", "support-title", "Harepin is still being built"),
      note,
    );
    const sent = el("div", "support-sent");
    sent.append(
      el("p", "", "Each link opens a GitHub issue with this filled in:"),
      facts,
      el("small", "menu-caption", "Posting needs a GitHub account. Links open in a new tab."),
    );

    const list = el("nav", "support-list");
    list.setAttribute("aria-label", "Open a GitHub issue");
    const links = KINDS.map((kind) => {
      const link = el("a", "support-row");
      link.target = "_blank";
      link.rel = "noopener";
      const text = el("span", "support-text");
      text.append(el("b", "", kind.title), el("small", "", kind.note));
      const out = icon("icon-external");
      out.classList.add("support-out");
      link.append(icon(kind.icon), text, out);
      list.append(link);
      return { kind, link };
    });

    let last: IssueFields | null = null;
    this.menu.sync(() => {
      const fields = this.fields();
      if (last && FIELD_LABELS.every(([key]) => fields[key] === last?.[key])) return;
      for (const [key, value] of values) if (fields[key] !== last?.[key]) value.textContent = fields[key];
      for (const { kind, link } of links) link.href = issue_link(kind.template, fields);
      last = fields;
    });

    const page = el("div", "support-page");
    page.append(about, list, sent);
    return [page];
  }
}
