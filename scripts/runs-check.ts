import "./fake-dom";

const { RUN_TYPES, WEEKLY_STAGES, daily, iso_week, resolve, resolve_stages, type_of, weekly } = await import("../src/runs/runs");
const { MODES } = await import("../src/modes/modes");
const { probe } = await import("../src/runs/run-world");
const { World } = await import("../src/world/world");
const { build_world, plain_map } = await import("../src/worldgen/kinds/kinds");
const { WORLDS } = await import("../src/worlds/worlds");
type World = import("../src/world/world").World;
type WorldKind = import("../src/worldgen/types").WorldKind;
type RunProbe = import("../src/runs/runs").RunProbe;

// Vets the Runs combo list (`RUN_TYPES` in src/runs/runs.ts) the way career-check vets events: every type on every
// kind it lists, over `--seeds N` seeds, must find one of its levels (else the run falls back to the map's circuit
// race), and that circuit must exist. A choice (length, ramp) a kind never offers is reported, not failed: its type's
// other levels stand in, and so is a level a kind never has. Then `--days N` dailies from today (UTC) are picked and resolved as a player would get them,
// and `--weeks N` weeklies from this ISO week: every stage it plays must be a level on the one map, in a mode that
// streams when the map does, and at least `WEEKLY_STAGES.min` must be left, or the week fails. A stage that falls back
// to the circuit race is counted, as a daily's is.
const arg = (name: string, fallback: number) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? Number(process.argv[at + 1]) : fallback;
};
const SEEDS = arg("--seeds", 8);
const DAYS = arg("--days", 30);
const WEEKS = arg("--weeks", 12);
// More than this share of seeds falling back on one kind: drop the kind from the type.
const MAX_FALLBACK = 0.25;

const worlds = new Map<string, { world: World; probe: RunProbe }>();
function load(kind: WorldKind, seed: number) {
  const key = `${kind}:${seed}`;
  let got = worlds.get(key);
  if (!got) {
    const map = plain_map(kind, seed);
    const world = new World(seed, build_world(seed, kind, map.levels).data, undefined, map.levels);
    got = { world, probe: probe(world) };
    worlds.set(key, got);
  }
  return got;
}

let failed = 0;
const kinds = [...new Set(RUN_TYPES.flatMap((type) => type.kinds))];
const seeds = Array.from({ length: SEEDS }, (_, i) => 1 + i * 7919);
for (const kind of kinds) {
  const types = RUN_TYPES.filter((type) => type.kinds.includes(kind));
  const falls = new Map<string, number>();
  const misses = new Map<string, number>();
  let no_circuit = 0;
  const seen = new Set<string>();
  for (const seed of seeds) {
    const { probe: here } = load(kind, seed);
    if (!here.levels("race").includes("circuit")) no_circuit++;
    for (const type of types) {
      const pick = { ...daily("2026-01-01"), type: type.id, kind, seed, levels: type.levels, band: null };
      if (resolve(pick, here).fallback) falls.set(type.id, (falls.get(type.id) ?? 0) + 1);
      const have = here.levels(type.mode);
      for (const level of type.levels) if (have.includes(level)) seen.add(`${type.id} ${level}`);
      for (const option of type.choice?.options ?? []) {
        if (option.levels && !option.levels.some((level) => have.includes(level))) misses.set(`${type.id} ${option.id}`, (misses.get(`${type.id} ${option.id}`) ?? 0) + 1);
      }
    }
  }
  const bad = types.filter((type) => (falls.get(type.id) ?? 0) / seeds.length > MAX_FALLBACK);
  if (bad.length || no_circuit) failed++;
  const notes = [
    ...types.flatMap((type) => (falls.get(type.id) ? [`${type.id} falls back ${falls.get(type.id)}/${seeds.length}${bad.includes(type) ? " FAIL" : ""}`] : [])),
    ...[...misses].map(([what, n]) => `${what} missing ${n}/${seeds.length}`),
    ...types.flatMap((type) => type.levels.filter((level) => !seen.has(`${type.id} ${level}`)).map((level) => `${type.id} ${level} never`)),
    ...(no_circuit ? [`no circuit ${no_circuit}/${seeds.length} FAIL`] : []),
  ];
  console.log(`${WORLDS[kind].name}: ${types.length} types${notes.length ? ` | ${notes.join(", ")}` : " | ok"}`);
}

const start = Date.now();
let fallbacks = 0;
for (let day = 0; day < DAYS; day++) {
  const date = new Date(start + day * 86_400_000).toISOString().slice(0, 10);
  const pick = daily(date);
  const resolved = resolve(pick, load(pick.kind, pick.seed).probe);
  if (resolved.fallback) fallbacks++;
  const car = "cap" in pick.car ? `cap ${pick.car.cap}` : pick.car.preset;
  console.log(`${date} ${type_of(pick.type).name} on ${WORLDS[pick.kind].name} ${pick.seed}: ${resolved.mode} ${resolved.level}${resolved.fallback ? " (fallback)" : ""} · ${car}`);
}
console.log(`${DAYS} dailies, ${fallbacks} fell back to the circuit race`);

let bad_weeks = 0;
let week_falls = 0;
for (let at = 0; at < WEEKS; at++) {
  const week = iso_week(new Date(start + at * 7 * 86_400_000).toISOString().slice(0, 10));
  const pick = weekly(week);
  const { world, probe: here } = load(pick.kind, pick.seed);
  const stages = pick.stages ?? [];
  const resolved = resolve_stages(pick, here);
  const falls = stages.filter((stage) => resolve({ ...pick, ...stage, stages: null }, here).fallback).map((stage) => `${type_of(stage.type).name} falls back`);
  week_falls += falls.length;
  const problems = [
    ...(resolved.length < WEEKLY_STAGES.min ? [`${resolved.length} stages left`] : []),
    ...resolved.filter((got) => !here.levels(got.mode).includes(got.level)).map((got) => `${got.mode} ${got.level} not on the map`),
    ...(world.tiles.streamed ? resolved.filter((got) => !MODES.find((m) => m.id === got.mode)?.streams).map((got) => `${got.mode} does not stream`) : []),
  ];
  if (problems.length) bad_weeks++;
  const car = "cap" in pick.car ? `cap ${pick.car.cap}` : pick.car.preset;
  const list = resolved.map((got) => `${got.mode} ${got.level}`).join(", ");
  const notes = [...falls, ...(problems.length ? [`FAIL ${problems.join(", ")}`] : [])];
  console.log(`${week} on ${WORLDS[pick.kind].name} ${pick.seed}: ${list} · ${car}${notes.length ? ` | ${notes.join(", ")}` : ""}`);
}
console.log(`${WEEKS} weeklies, ${week_falls} stages fell back to the circuit race, ${bad_weeks} failed`);
if (bad_weeks) failed++;
console.log(failed ? `${failed} kinds or weeks need a fix in RUN_TYPES` : "every run type finds its levels on the kinds it lists, and every weekly plays its stages on its map");
if (failed) process.exitCode = 1;
