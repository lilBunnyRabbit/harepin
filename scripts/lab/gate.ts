import "../fake-dom";
import { parse_build } from "../../src/car/build";
import { within } from "../../src/car/car-pick";
import { CARS, is_car, type CarId } from "../../src/car/cars";
import { class_of, spec_pi } from "../../src/car/pi";
import { PRESETS } from "../../src/car/presets";
import { check_bands } from "./feel-bands";
import type { Moved } from "./handling-golden";

const { EVENTS } = await import("../../src/career/career");

function run(label: string, cmd: string[], pipe = false): { ok: boolean; out: string } {
  console.log(`\n## ${label}: ${cmd.join(" ")}`);
  const r = Bun.spawnSync(cmd, { stdout: pipe ? "pipe" : "inherit", stderr: "inherit" });
  const out = pipe ? (r.stdout?.toString() ?? "") : "";
  if (pipe) process.stdout.write(out);
  if (r.exitCode !== 0) console.log(`RED ${label} (exit ${r.exitCode})`);
  return { ok: r.exitCode === 0, out };
}

const class_letter = (fields: string[]) => fields.find((f) => f.startsWith("pi "))?.match(/^pi \d+(\w+)->\d+(\w+)$/);

/** Every event the car can start: a class cap at or over its own (career.ts tunes it up to the cap), or a preset of it. */
function events_of(car: CarId): string[] {
  const cls = class_of(spec_pi(CARS[car]));
  return EVENTS.filter((e) => ("cap" in e.car ? within(cls, e.car.cap) : parse_build(PRESETS.find((p) => p.name === (e.car as { preset: string }).preset)?.code ?? "")?.car === car)).map((e) => e.id);
}

/** Stars career.ts printed that differ from the committed marks, per event or championship stage. */
function moved_stars(out: string): string[] {
  const moved: string[] = [];
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^(\S+)(?: stage (\d+))? \S+ \S+ on \S+: stars: \{ two: (\d+), three: (\d+) \}/);
    if (!m) continue;
    const event = EVENTS.find((e) => e.id === m[1]);
    const marks = m[2] ? event?.stages?.[Number(m[2]) - 1]?.stars : event?.stars;
    const two = Number(m[3]);
    const three = Number(m[4]);
    if (!marks || marks.two !== two || marks.three !== three) moved.push(`${m[1]}${m[2] ? ` stage ${m[2]}` : ""} two ${marks?.two ?? "-"}->${two} three ${marks?.three ?? "-"}->${three}`);
  }
  return moved;
}

/** The plan's section 7 gate, steps 2-6, for one car per commit; stops on the first red. */
export async function run_gate(car: string, golden: () => Promise<Moved[] | null>): Promise<number> {
  if (!is_car(car)) throw new Error(`unknown car "${car}"`);
  if (!run("car tests", ["bun", "test", "src/car"]).ok) return 1;

  console.log("\n## handling golden");
  const moved = await golden();
  if (moved === null) return console.log("RED golden: a sim failed"), 1;
  const others = moved.filter((m) => m.car !== car);
  if (others.length) return console.log(`RED golden: other cars moved: ${others.map((m) => m.key).join(", ")}`), 1;
  console.log(moved.length ? `${moved.length} ${car} rows moved` : `no ${car} row moved`);
  const bands = check_bands(moved);
  for (const w of bands.warn) console.log(`warn band: ${w}`);
  if (bands.red.length) return console.log(`RED band (docs/car-feel.md): ${bands.red.join(", ")}`), 1;

  const crossed = moved.flatMap((m) => {
    const c = class_letter(m.fields);
    return c && c[1] !== c[2] ? [`${m.key} ${c[1]}->${c[2]}`] : [];
  });
  if (crossed.length) return console.log(`RED class: ${crossed.join(", ")}; the owner approves a class move per case (O7)`), 1;

  if (!run("races", ["bun", "scripts/races.ts", "--changed"]).ok) return 1;

  const events = events_of(car);
  if (events.length) {
    const career = run(`career (${events.length} events)`, ["bun", "scripts/career.ts", ...events], true);
    if (!career.ok) return 1;
    const stars = moved_stars(career.out);
    if (stars.length) return console.log(`RED career stars moved: ${stars.join("; ")}; under 2% hold the marks, above re-run career.ts --write (O5)`), 1;
  }
  console.log("\nGREEN: commit the car with `bun scripts/lab.ts golden`'s rewrite of scripts/golden/handling.txt");
  return 0;
}
