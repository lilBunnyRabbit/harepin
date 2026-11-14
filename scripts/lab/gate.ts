import "../fake-dom";
import { CARS, is_car } from "../../src/car/cars";
import { class_of, spec_pi } from "../../src/car/pi";
import type { Moved } from "./handling-golden";

const { EVENTS } = await import("../../src/career/career");

function run(label: string, cmd: string[]): boolean {
  console.log(`\n## ${label}: ${cmd.join(" ")}`);
  const { exitCode } = Bun.spawnSync(cmd, { stdout: "inherit", stderr: "inherit" });
  if (exitCode !== 0) console.log(`RED ${label} (exit ${exitCode})`);
  return exitCode === 0;
}

const class_letter = (fields: string[]) => fields.find((f) => f.startsWith("pi "))?.match(/^pi \d+(\w+)->\d+(\w+)$/);

/** The plan's section 7 gate, steps 2-6, for one car per commit; stops on the first red. */
export async function run_gate(car: string, golden: () => Promise<Moved[] | null>): Promise<number> {
  if (!is_car(car)) throw new Error(`unknown car "${car}"`);
  if (!run("car tests", ["bun", "test", "src/car"])) return 1;

  console.log("\n## handling golden");
  const moved = await golden();
  if (moved === null) return console.log("RED golden: a sim failed"), 1;
  const others = moved.filter((m) => m.car !== car);
  if (others.length) return console.log(`RED golden: other cars moved: ${others.map((m) => m.key).join(", ")}`), 1;
  if (!moved.length) console.log(`no ${car} row moved: nothing to gate past this point`);
  console.log(`${moved.length} ${car} rows moved; check each against docs/car-feel.md, then \`bun scripts/lab.ts golden\` and commit it with the change`);

  const crossed = moved.flatMap((m) => {
    const c = class_letter(m.fields);
    return c && c[1] !== c[2] ? [`${m.key} ${c[1]}->${c[2]}`] : [];
  });
  if (crossed.length) return console.log(`RED class: ${crossed.join(", ")}; the owner approves a class move per case (O7)`), 1;

  if (!run("races", ["bun", "scripts/races.ts", "--changed"])) return 1;

  const cls = class_of(spec_pi(CARS[car]));
  const events = EVENTS.filter((e) => "cap" in e.car && e.car.cap === cls).map((e) => e.id);
  if (events.length && !run(`career (class ${cls})`, ["bun", "scripts/career.ts", ...events])) return 1;
  console.log("\nGREEN: read the career stars above; a moved `three` under 2% holds the marks, above re-run career.ts --write (O5)");
  return 0;
}
