import { format } from "../hud/hud";
import { WORLDS } from "../worlds/worlds";
import { turn_to, type Driven, type Finish, type ModeCtx, type ModeDef, type ModeRun, type RouteRun } from "./mode";
import { COUNTDOWN_MS, RaceRun, RaceStatus, race_course, race_levels, type RaceCourse, type RaceLevel } from "./races";
import { RaceView } from "./race-view";
import { best_line, line, result_title } from "./result";

class Race implements ModeRun {
  private readonly view: RaceView;
  private readonly unplace: () => void;
  private run: RaceRun;
  private clock = 0;
  private result: Finish | null = null;
  readonly route: RouteRun;

  constructor(
    private readonly ctx: ModeCtx,
    private readonly level: RaceLevel,
    course: RaceCourse,
  ) {
    this.view = new RaceView(course, ctx.world);
    ctx.scene.add(this.view.root);
    this.unplace = ctx.world.place(course.route.closure);
    this.run = new RaceRun(course, ctx.lobby_lap() ? 0 : COUNTDOWN_MS);
    this.route = { id: course.route.id, gate: this.run.gate, respawn: course.line[0] };
    ctx.spawn_on(course.line[0]);
  }

  get holding(): boolean {
    return this.run.countdown > 0;
  }

  update(sim_dt: number, car: Driven): string | null {
    const { run, view, ctx } = this;
    const lobby_lap = ctx.lobby_lap();
    if (lobby_lap && !ctx.race_busy()) {
      ctx.exit();
      return null;
    }
    // The countdown holds the sim, so it runs on the wall clock.
    const now = performance.now();
    const wall = this.clock ? now - this.clock : 0;
    this.clock = now;
    const was = run.status;
    const taken = run.update(run.countdown > 0 ? wall : sim_dt * 1000, car.pos.x, car.pos.z);
    if (taken >= 0) {
      this.route.respawn = run.course.line[run.course.gates[taken]];
      view.aim(run.next);
      if (run.status !== RaceStatus.DONE) ctx.chime();
    }
    if (was !== RaceStatus.DONE && run.status === RaceStatus.DONE) {
      this.route.gate = null;
      ctx.hide_hint();
      view.guide(0, 0);
      if (!lobby_lap) this.finish();
      else if (!lobby_lap()) ctx.exit();
      else {
        this.run = new RaceRun(run.course, 0);
        this.route.respawn = run.course.line[0];
        view.aim(0);
      }
      return null;
    }
    // A finished run keeps updating behind the result card, with no gate left to aim at.
    const gate = run.gate;
    this.route.gate = gate;
    if (!gate) return null;
    const { gates } = run.course;
    view.guide(run.tracker.index, gates[run.next]);
    ctx.hint(turn_to(car, gate.x, gate.z));
    const { name } = this.level;
    if (run.status === RaceStatus.READY) return `${name} · ${Math.ceil(run.countdown / 1000)}`;
    const doing = run.missed ? "missed a gate, go back" : `gate ${run.next + 1}/${gates.length}`;
    return `${name} · ${format(run.elapsed())} · ${doing}`;
  }

  private finish() {
    const { run, level } = this;
    const { track } = this.ctx;
    const { par_ms, length } = run.course.route;
    const stars = run.stars();
    const ms = Math.round(run.elapsed());
    const recorded = track.record(level.id, { stars, ms });
    this.result = {
      title: result_title(level.name, recorded),
      stars,
      lines: [line("time", format(ms)), line("length", `${(length / 1000).toFixed(1)} km`), line("par", format(par_ms)), best_line(track.runs[level.id])],
    };
  }

  finished(): Finish | null {
    return this.result;
  }

  dispose() {
    this.unplace();
    this.view.dispose();
  }
}

export const RACE_MODE: ModeDef<RaceLevel> = {
  id: "race",
  name: "Race",
  needs_ground: false,
  car_sized_only: false,
  busy_notice: "Leave the lobby race to race solo",
  levels: (world) => race_levels(world.routes, WORLDS[world.kind].map_label),
  start(ctx, level) {
    const route = ctx.world.routes.find((r) => r.id === level.id);
    return route ? new Race(ctx, level, race_course(route)) : null;
  },
};
