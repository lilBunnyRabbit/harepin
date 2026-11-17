import { readFileSync } from "node:fs";
import { pass_table, phase_table, read_passes } from "./pass-read";

// bun scripts/ai-ml/passes.ts <file>...: the passes in `?lab=ai-pass` exports (Download files or pasted Copy blocks), a row each, then per corner phase.

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("usage: passes.ts <downloaded or pasted export>...");
  const trials = files.flatMap((file) => read_passes(readFileSync(file, "utf8")));
  if (!trials.length) throw new Error("no passes block in the export: drive ?lab=ai-pass and Download");
  for (const trial of trials) {
    const made = trial.passes.filter((p) => p.made).length;
    console.log(`## ${trial.pack} r${trial.rev} ${trial.id}: ${trial.car} on ${trial.place}, ${trial.status}`);
    console.log(`${made} made, ${trial.passes.length - made} lost against ${trial.ai_cars} AI cars; lap ${trial.lap_m.toFixed(0)} m; ${trial.samples.length} grid samples at ${trial.hz} Hz${trial.full ? "; the trace ran out of room" : ""}\n`);
    console.log(`${pass_table(trial)}\n\n${phase_table(trial)}\n`);
  }
}
