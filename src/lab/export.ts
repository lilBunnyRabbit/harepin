import type { Mod } from "../car/build";
import { CLASS_LABELS } from "../car/pi";
import { questions_of } from "./answers";
import type { TrialResult } from "./lab";
import type { Goal, Pack, Resolved } from "./pack";
import type { Metrics } from "./recorder";

/** Where and how the owner drove: a twitchy rating on touch reads differently from one on a pad. */
export interface Device {
  input: "touch" | "keys" | "pad";
  width: number;
  height: number;
}

/** Answers per trial id, question id to a value; `note` is quoted free text. */
export type Answers = Record<string, Record<string, string | number>>;

/** Below this a number is float noise (a straight run's slip and lateral g), printed as 0, not as `3.7e-15`. */
const NOISE = 1e-6;

export const short = (v: number) => (Math.abs(v) < NOISE ? "0" : String(Number(v.toPrecision(3))));

export function mods_text(mods: readonly Mod[] = []): string {
  const parts: string[] = [];
  for (const mod of mods) {
    for (const [field, v] of Object.entries(mod.scale ?? {})) parts.push(`${field}*${short(v)}`);
    for (const [field, v] of Object.entries(mod.add ?? {})) parts.push(`${field}${v < 0 ? "" : "+"}${short(v)}`);
  }
  return parts.length ? ` ${parts.map((p) => `+${p}`).join(" ")}` : "";
}

export function goal_text(goal: Goal): string {
  if (goal.kind === "laps") return `laps${goal.laps}`;
  if (goal.kind === "time") return `time${goal.seconds}`;
  if (goal.kind === "stop") return `stop${goal.from_kmh}`;
  return goal.kind;
}

const pair = (a: number, b: number) => `${Number.isNaN(a) ? "-" : short(a)}/${Number.isNaN(b) ? "-" : short(b)}`;

/** Key and value text in a fixed order; a key whose numbers the trial never measured is left out. */
export function metric_pairs(m: Metrics): [key: string, text: string][] {
  const out: [string, string][] = [["time", short(m.time)]];
  const put = (key: string, v: number, text = short(v)) => {
    if (!Number.isNaN(v)) out.push([key, text]);
  };
  if (m.laps.length) out.push(["lap", m.laps.map(short).join(",")]);
  put("seg", m.segment);
  put("latg", m.lat_peak, pair(m.lat_peak, m.lat_mean));
  put("ring", m.ring_kmh);
  put("slip", m.slip_peak, pair(m.slip_peak, m.slip_mean));
  put("held", m.held);
  put("chain", m.chain);
  put("spins", m.spins);
  put("lag", m.yaw_lag);
  put("rec", m.recovery);
  put("0-100", m.to_100);
  put("stop", m.stop_m, `${short(m.stop_m)}@${short(m.stop_from)}`);
  put("top", m.top_kmh);
  put("spin", m.wheelspin, pair(m.wheelspin, m.spin_peak));
  put("air", m.air);
  put("land", m.landing);
  put("bounce", m.bounces);
  put("offs", m.offs);
  put("resets", m.resets);
  put("lock", m.lock);
  put("thr", m.throttle);
  put("hb", m.handbrake);
  put("rev", m.reversals);
  return out;
}

const metrics_text = (m: Metrics) => metric_pairs(m).map(([key, text]) => `${key}=${text}`).join(" ");

const quote = (text: string) => JSON.stringify(text.replace(/\s+/g, " ").trim());

/** One paste-able block: line-based, so two runs of a pack diff line by line and survive a chat app. */
export function export_block(pack: Pack, trials: readonly Resolved[], results: readonly TrialResult[], answers: Answers, version: string, device: Device, at: Date): string {
  const lines = [`#lab ${pack.id} r${pack.rev} v${version} ${at.toISOString().slice(0, 16)}Z ${device.input} ${device.width}x${device.height}`];
  let driven = 0;
  trials.forEach((r, i) => {
    const result = results[i];
    const { trial } = r;
    const lane = r.lane.name;
    lines.push(`#trial ${trial.id} ${trial.car}${mods_text(trial.mods)} spec#${r.hash} pi${r.pi}${CLASS_LABELS[r.class]} ${trial.station}/${lane} ${goal_text(trial.goal)} ${result.status === "new" ? "skipped" : result.status}`);
    if (result.metrics) {
      driven++;
      lines.push(` m ${metrics_text(result.metrics)}`);
    }
    const given = answers[trial.id] ?? {};
    // Question order, not tap order: two runs of a pack diff line by line.
    const asked = questions_of(pack, trial).flatMap(({ id }) => {
      const v = given[id];
      if (id === "note" || v === undefined || (typeof v === "string" && !v.trim())) return [];
      return [`${id}=${typeof v === "number" ? v : quote(v)}`];
    });
    if (asked.length) lines.push(` a ${asked.join(" ")}`);
    if (typeof given.note === "string" && given.note.trim()) lines.push(` n ${quote(given.note)}`);
  });
  lines.push(`#end ${driven}/${trials.length} trials`);
  return lines.join("\n");
}
