import { DEFAULT_PARTS, STATS, build_spec, stat_range, stats, type Build, type Stats } from "../car/build";
import { ease } from "./garage-stage";
import { el } from "./setting-rows";

const STAT_NAMES: Record<keyof Stats, string> = { power: "Power", grip: "Grip", braking: "Braking", top_speed: "Top speed" };
// An empty bar reads as broken, so the weakest car in the game still shows a sliver.
const BAR_FLOOR = 0.08;
const COUNT_MS = 450;

const bar_of = (key: keyof Stats, value: number) => {
  const { low, high } = stat_range();
  return BAR_FLOOR + (1 - BAR_FLOOR) * Math.max(0, Math.min(1, (value - low[key]) / (high[key] - low[key])));
};
const rating = (key: keyof Stats, value: number) => Math.round(bar_of(key, value) * 100);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const trend = (n: number) => (n > 0 ? "up" : n < 0 ? "down" : "flat");

interface Meter {
  value: HTMLElement;
  change: HTMLElement;
  fill: HTMLElement;
  ghost: HTMLElement;
  stock: HTMLElement;
  shown: number;
  count: number;
}

export class StatMeters {
  private readonly meters = new Map<keyof Stats, Meter>();
  private readonly calm = matchMedia("(prefers-reduced-motion: reduce)");

  constructor(panel: HTMLElement) {
    panel.append(el("h3", "garage-panel-title", "Against stock"));
    const rows = el("div", "garage-meters");
    for (const key of STATS) {
      const value = el("span", "garage-meter-value");
      const change = el("span", "garage-meter-change");
      const track = el("div", "garage-meter");
      const fill = el("div", "garage-meter-fill");
      const ghost = el("div", "garage-meter-ghost");
      const stock = el("i", "garage-meter-stock");
      track.append(fill, ghost, stock);
      const stat = el("div", "garage-stat");
      stat.append(el("span", "garage-meter-label", STAT_NAMES[key]), value, change, track);
      rows.append(stat);
      this.meters.set(key, { value, change, fill, ghost, stock, shown: Number.NaN, count: 0 });
    }
    panel.append(rows);
  }

  stop() {
    for (const meter of this.meters.values()) cancelAnimationFrame(meter.count);
  }

  render(current: Build, shown: Build) {
    const now = stats(build_spec(current));
    const next = stats(build_spec(shown));
    const stock = stats(build_spec({ ...shown, parts: DEFAULT_PARTS }));
    for (const [key, meter] of this.meters) {
      const a = bar_of(key, now[key]);
      const b = bar_of(key, next[key]);
      const lo = Math.min(a, b);
      meter.fill.style.width = `${lo * 100}%`;
      meter.ghost.style.left = `${lo * 100}%`;
      meter.ghost.style.width = `${Math.abs(b - a) * 100}%`;
      meter.stock.style.left = `${bar_of(key, stock[key]) * 100}%`;
      const fitted = rating(key, now[key]);
      const tried = rating(key, next[key]);
      meter.ghost.dataset.trend = trend(tried - fitted);
      if (tried !== fitted) {
        meter.change.textContent = `→ ${tried}`;
        meter.change.dataset.trend = trend(tried - fitted);
      } else {
        const against = fitted - rating(key, stock[key]);
        meter.change.textContent = against ? signed(against) : "";
        meter.change.dataset.trend = trend(against);
      }
      this.count(meter, fitted);
    }
  }

  private count(meter: Meter, to: number) {
    const from = meter.shown;
    meter.shown = to;
    cancelAnimationFrame(meter.count);
    if (Number.isNaN(from) || from === to || this.calm.matches) {
      meter.value.textContent = String(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / COUNT_MS);
      meter.value.textContent = String(Math.round(from + (to - from) * ease(u)));
      if (u < 1) meter.count = requestAnimationFrame(step);
    };
    meter.count = requestAnimationFrame(step);
  }
}
