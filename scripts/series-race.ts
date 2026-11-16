import { at_difficulty, Difficulty } from "../src/ai/difficulty";
import { Field, field_personalities } from "../src/ai/field";
import { field_builds } from "../src/ai/field-pick";
import { build_spec, parse_build } from "../src/car/build";
import { within } from "../src/car/car-pick";
import { PRESETS } from "../src/car/presets";
import { rating } from "../src/car/pi";
import { empty_progress, event_field, SeriesKind, type Season } from "../src/career/series";
import { field_races } from "../src/modes/field-route";
import { SEASONS } from "../src/career/series-seasons";
import { race_laps } from "../src/modes/race-laps";
import { World } from "../src/world/world";
import { build_world, KINDS, plain_map } from "../src/worldgen/kinds/kinds";
import { SIZE } from "../src/worldgen/types";
import { CONTACT_BAND, FIELD_SLACK } from "./ai-race";
import { DT } from "./autolap";
import { stream_in } from "./stream-in";

// bun scripts/series-race.ts [season id…]: every series event's field, named drivers at their levels on normal, races
// its route on its own map for the laps the game would give a race there (an endurance event as a plain race). Fails
// when a car is stuck or a race's contacts per lap fall outside CONTACT_BAND, as `ai-race.ts field` does; when the field
// spins or resets more than SPINS_MAX / RESETS_MAX times in the race (I4: an AI that looks stupid); and when a race
// event's field never passes (a procession).
const SPINS_MAX = 1;
const RESETS_MAX = 1;

/** The player's stand-in at the cap: the strongest preset within it, so the field picks the class the season races. */
function stand_in(season: Season) {
  const fits = PRESETS.flatMap((p) => {
    const build = parse_build(p.code);
    return build && within(rating(build).class, season.cap) ? [build] : [];
  });
  return fits.sort((a, b) => rating(b).pi - rating(a).pi)[0];
}

const wanted = process.argv.slice(2);
let failed = 0;
for (const season of SEASONS.filter((s) => !wanted.length || wanted.includes(s.id))) {
  const player = stand_in(season);
  for (const event of season.events) {
    const map = plain_map(season.world, event.seed);
    const data = build_world(event.seed, season.world, map.levels).data;
    const world = new World(event.seed, data, KINDS[season.world].size > SIZE ? [] : undefined, map.levels);
    const route = world.routes.find((r) => r.id === event.route);
    if (!route || !field_races(route, world.tiles.streamed, KINDS[season.world].rails)) throw new Error(`${event.id}: ${event.route} on ${season.world} ${event.seed} races no field`);
    const drivers = event_field(season, event, empty_progress(season)).map((i) => season.field[i]);
    const builds = field_builds(player, rating(player), drivers.length, route.excludes);
    const traits = at_difficulty(field_personalities(world.seed, drivers), Difficulty.NORMAL);
    const laps = race_laps(route.par_ms, null);
    stream_in(world, data.ground, [...route.points, route.points[0]]);
    const unplace = world.place(route.closure);
    const field = new Field(world, route, builds.map(build_spec), traits, world.seed);
    let plan = 0;
    for (let i = 0; i < field.line.step.length; i++) plan += field.line.step[i] / field.line.speed[i];
    const all = field.run(DT, laps, plan * laps * FIELD_SLACK + 30);
    unplace();
    const contacts = field.racers.reduce((sum, r) => sum + r.stats.contacts, 0) / 2;
    const rate = contacts / laps;
    const band = rate >= CONTACT_BAND[0] && rate <= CONTACT_BAND[1];
    const sum = (key: "spins" | "resets" | "overtakes") => field.racers.reduce((n, r) => n + r.stats[key], 0);
    const hardest = Math.max(...field.racers.map((r) => r.stats.hardest));
    const best = Math.min(...field.racers.map((r) => r.stats.finish));
    const procession = event.kind === SeriesKind.RACE && sum("overtakes") === 0;
    const bad = !all || !band || sum("spins") > SPINS_MAX || sum("resets") > RESETS_MAX || procession;
    if (bad) failed++;
    console.log(`${event.id.padEnd(14)} ${season.world} ${event.seed} ${event.route.padEnd(11)} ${builds.length} x ${builds[0]?.car} ${laps} laps ${best.toFixed(0)}s | ${all ? "all finished" : "STUCK"}, ${rate.toFixed(1)} contacts/lap${band ? "" : " OUT OF BAND"}, passes ${sum("overtakes")}, spins ${sum("spins")}, resets ${sum("resets")}, hardest ${hardest.toFixed(1)} m/s${procession ? " PROCESSION" : ""}${bad ? " FAIL" : ""}`);
  }
}
console.log(failed ? `${failed} FAILED` : "every event clean");
if (failed) process.exitCode = 1;
