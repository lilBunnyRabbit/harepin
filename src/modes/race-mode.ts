import { Ghost } from "../car/ghost";
import { format } from "../hud/hud";
import { WORLDS } from "../worlds/worlds";
import type { Hits } from "./hits";
import { turn_to, type Driven, type Finish, type ModeCtx, type ModeDef, type ModeRun, type RouteRun } from "./mode";
import { COUNTDOWN_MS, RaceRun, RaceStatus, race_course, race_levels, type RaceCourse, type RaceLevel } from "./races";
import { RaceView } from "./race-view";
import { best_line, line, penalty_text, result_title, time_lines } from "./result";
import { grade, par_thresholds } from "./track";

// Never written: the dev ghost is read from the shipped asset, and a race keeps no ghost of the player's own.
const DEV_GHOST_KEY = "harepin:ghost:career-dev";

class Race implements ModeRun {
  private readonly view: RaceView;
  private readonly unplace: () => void;
  private run: RaceRun;
  private clock = 0;
  private result: Finish | null = null;
  private readonly hits: Hits | null;
  private ghost: Ghost | null = null;
  private disposed = false;
  readonly route: RouteRun;

  constructor(
    private readonly ctx: ModeCtx,
    private readonly level: RaceLevel,
    course: RaceCourse,
  ) {
    this.view = new RaceView(course, ctx.ground);
    ctx.scene.add(this.view.root);
    this.unplace = ctx.world.place(course.route.closure);
    this.run = new RaceRun(course, ctx.lobby_lap() ? 0 : COUNTDOWN_MS);
    this.hits = ctx.hits();
    void ctx.dev_ghost().then((lap) => {
      if (!lap || this.disposed) return;
      this.ghost = new Ghost(ctx.scene, ctx.world.seed, DEV_GHOST_KEY);
      this.ghost.use(lap);
    });
    const start = course.line[ctx.lobby_lap() ? 0 : Math.min(ctx.route_at, course.line.length - 1)];
    this.route = { id: course.route.id, gate: this.run.gate, later: this.later(0), respawn: start };
    ctx.spawn_on(start);
  }

  private later(next: number): RouteRun["later"] {
    const { line, gates } = this.run.course;
    return gates.slice(next + 1).map((at) => line[at]);
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
    this.hits?.update(sim_dt * 1000, run.status === RaceStatus.RUNNING || was === RaceStatus.RUNNING);
    if (this.ghost) {
      this.ghost.visible = ctx.ghosts();
      this.ghost.update(run.status === RaceStatus.RUNNING ? run.elapsed() : null, ctx.camera.position);
    }
    view.update(sim_dt);
    if (taken >= 0) {
      this.route.respawn = run.course.line[run.course.gates[taken]];
      this.route.later = this.later(run.next);
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
        this.route.later = this.later(0);
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
    return `${name} · ${format(run.elapsed())}${penalty_text(this.hits)} · ${doing}`;
  }

  private finish() {
    const { run, level } = this;
    const { track } = this.ctx;
    const { par_ms, length } = run.course.route;
    const time = Math.round(run.elapsed());
    const ms = time + (this.hits?.penalty_ms ?? 0);
    const par = this.ctx.thresholds(par_thresholds(par_ms));
    const stars = grade(run.elapsed() + (this.hits?.penalty_ms ?? 0), par);
    const recorded = track.record(level.id, { stars, ms });
    this.result = {
      title: result_title(level.name, recorded),
      stars,
      lines: [...time_lines(time, this.hits), line("length", `${(length / 1000).toFixed(1)} km`), line("par", format(par.three)), best_line(track.runs[level.id])],
    };
  }

  finished(): Finish | null {
    return this.result;
  }

  dispose() {
    this.disposed = true;
    this.ghost?.dispose();
    this.unplace();
    this.view.dispose();
  }
}

export const RACE_MODE: ModeDef<RaceLevel> = {
  id: "race",
  name: "Race",
  goal: "Drive through each lit gate to the finish line.",
  needs_ground: false,
  car_sized_only: false,
  busy_notice: "Leave the lobby race to race solo",
  streams: true,
  levels: (world) => race_levels(world.routes, WORLDS[world.kind].map_label),
  start(ctx, level) {
    const route = ctx.world.routes.find((r) => r.id === level.id);
    return route ? new Race(ctx, level, race_course(route)) : null;
  },
};
