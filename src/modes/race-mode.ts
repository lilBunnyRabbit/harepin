import { Ghost } from "../car/ghost";
import { format } from "../hud/hud";
import { WORLDS } from "../worlds/worlds";
import type { Hits } from "./hits";
import { mode_status, turn_to, type Driven, type Finish, type ModeCtx, type ModeDef, type ModeRun, type ModeStatus, type RouteRun, type StatusCaptions } from "./mode";
import { drift_stars } from "./drift";
import { COUNTDOWN_MS, RACE_CAPTIONS, RaceRun, TRAP_CAPTIONS, RaceStatus, TrapRun, kmh, race_course, race_levels, trap_points, type RaceCourse, type RaceLevel } from "./races";
import { RaceView } from "./race-view";
import { AiRace } from "./ai-race";
import { field_races } from "./field-route";
import { KINDS } from "../worldgen/kinds/kinds";
import { best_line, line, penalty_text, result_title, time_lines } from "./result";
import { SILVER_SHARE, grade, par_thresholds, type StarRun } from "./track";
import { hypot } from "../sim-math";
import { StartBeeps } from "./start-steps";
import { NO_RULES, Stewards } from "./race-rules";
import { faces_back } from "./wrong-way";

// Never written: the dev ghost is read from the shipped asset, and a race keeps no ghost of the player's own.
const DEV_GHOST_KEY = "harepin:ghost:career-dev";
/** A speed trap's 3-star mark per trap, km/h; career events bring their own. */
const TRAP_KMH = 180;
const FLASH_MS = 1500;

class Race implements ModeRun {
  private readonly view: RaceView;
  private readonly unplace: () => void;
  private run: RaceRun;
  private clock = 0;
  private result: Finish | null = null;
  private readonly hits: Hits | null;
  private readonly stewards: Stewards;
  private ghost: Ghost | null = null;
  private disposed = false;
  /** A lobby lap starts on the lobby's countdown, which beeps on its own. */
  private readonly beeps: StartBeeps | null;
  private readonly traps: TrapRun | null;
  private flash: { kmh: number; at: number } | null = null;
  /** A solo run over laps: the lap under way, and the time of the laps before it. */
  private readonly laps: number;
  private lap = 1;
  private banked = 0;
  readonly route: RouteRun;
  private readonly status: ModeStatus;
  readonly captions?: StatusCaptions;

  constructor(
    private readonly ctx: ModeCtx,
    private readonly level: RaceLevel,
    course: RaceCourse,
  ) {
    this.status = mode_status(level.name);
    this.traps = level.trap ? new TrapRun(trap_points(course.line, course.gates), course.route.gate_hw) : null;
    if (this.traps) this.captions = TRAP_CAPTIONS;
    this.view = new RaceView(course, ctx.ground, this.traps?.at);
    ctx.scene.add(this.view.root);
    this.unplace = ctx.world.place(course.route.closure);
    this.run = new RaceRun(course, ctx.lobby_lap() ? 0 : COUNTDOWN_MS);
    this.beeps = ctx.lobby_lap() ? null : new StartBeeps(COUNTDOWN_MS / 1000);
    this.laps = ctx.lobby_lap() || !course.route.closed ? 1 : Math.max(1, ctx.laps);
    this.hits = ctx.hits();
    this.stewards = new Stewards(ctx.lobby_lap() ? NO_RULES : level.rules, course.line, course.route.gate_hw);
    this.status.gates = "";
    this.show_lap();
    void ctx.dev_ghost().then((lap) => {
      if (!lap || this.disposed) return;
      this.ghost = new Ghost(ctx.scene, ctx.world, DEV_GHOST_KEY);
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

  update(sim_dt: number, car: Driven): ModeStatus | null {
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
    this.route.progress = run.tracker.index;
    const beep = this.beeps?.next(run.countdown, now);
    if (beep) ctx.beep(beep);
    this.hits?.update(sim_dt * 1000, run.status === RaceStatus.RUNNING || was === RaceStatus.RUNNING);
    if (run.status === RaceStatus.RUNNING) {
      this.call(this.stewards.limits(car, ctx.world, this.lap - 1, run.tracker.index, sim_dt));
    }
    if (this.traps && (run.status === RaceStatus.RUNNING || was === RaceStatus.RUNNING)) {
      const passed = this.traps.next;
      const through = this.traps.update(run.tracker.index, run.tracker.offset, hypot(car.vel.x, car.vel.z));
      if (through !== null) {
        this.flash = { kmh: through, at: now };
        view.trap_passed(passed);
      }
    }
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
      this.call(this.stewards.settle(car, this.lap - 1, run.tracker.index));
      this.route.gate = null;
      ctx.hide_hint();
      view.unguide();
      if (!lobby_lap && this.lap < this.laps) {
        this.banked += run.elapsed();
        this.lap++;
        ctx.chime();
        this.next_lap();
      } else if (!lobby_lap) this.finish();
      else if (!lobby_lap()) ctx.exit();
      else this.next_lap();
      return null;
    }
    // A finished run keeps updating behind the result card, with no gate left to aim at.
    const gate = run.gate;
    this.route.gate = gate;
    if (!gate) return null;
    const { gates } = run.course;
    const wrong = view.guide(run.tracker.index, car.heading, run.tracker.offset, !lobby_lap && this.lap < this.laps);
    ctx.hint(turn_to(car, gate.x, gate.z), wrong);
    if (run.status === RaceStatus.RUNNING && this.stewards.wrong_way(faces_back(run.course.line[run.tracker.index], car.heading), sim_dt * 1000) && this.route.respawn) ctx.spawn_on(this.route.respawn);
    const { status } = this;
    if (run.status === RaceStatus.READY) {
      status.clock = String(Math.ceil(run.countdown / 1000));
      return status;
    }
    // A speed trap scores its km/h, so its total takes the clock and its traps the gates: both run its line under the touch chips.
    status.clock = this.traps ? kmh(this.traps.total) : `${format(this.elapsed())}${penalty_text(this.hits, this.stewards)}`;
    status.gates = run.missed ? "go back" : (this.trap_text(now) ?? `${run.next + 1}/${gates.length}`);
    return status;
  }

  private call(text: string | null) {
    if (text) this.ctx.toast(text);
  }

  private show_lap() {
    if (this.laps > 1) this.status.lap = `${this.lap}/${this.laps}`;
  }

  private next_lap() {
    this.show_lap();
    const { course } = this.run;
    this.run = new RaceRun(course, 0);
    this.route.respawn = course.line[0];
    this.view.aim(0);
    this.route.later = this.later(0);
  }

  private elapsed(): number {
    return this.banked + this.run.elapsed();
  }

  private trap_text(now: number): string | null {
    const { traps, flash } = this;
    if (!traps) return null;
    if (flash && now - flash.at < FLASH_MS) return flash.kmh ? kmh(flash.kmh) : "missed";
    return `${Math.min(traps.next + 1, traps.at.length)}/${traps.at.length}`;
  }

  private finish() {
    const { run, level } = this;
    const { track } = this.ctx;
    const { par_ms, length } = run.course.route;
    const { laps } = this;
    const { stewards } = this;
    const time = Math.round(this.elapsed());
    const penalty = (this.hits?.penalty_ms ?? 0) + stewards.penalty_ms;
    const ms = time + penalty;
    const par = this.ctx.thresholds(par_thresholds(par_ms * laps));
    const stars = grade(this.elapsed() + penalty, par);
    if (this.traps) return this.trap_finish(ms);
    const recorded = this.record({ stars, ms });
    this.result = {
      title: result_title(level.name, recorded),
      stars,
      lines: [...time_lines(time, this.hits, stewards), ...this.void_line(), line("length", `${((length * laps) / 1000).toFixed(1)} km${laps > 1 ? ` · ${laps} laps` : ""}`), line("par", format(par.three)), best_line(track.runs[level.id])],
    };
  }

  private trap_finish(ms: number) {
    const { level, traps } = this;
    if (!traps) return;
    const { track } = this.ctx;
    const { par_ms, length } = this.run.course.route;
    const three = traps.at.length * TRAP_KMH;
    const marks = this.ctx.thresholds({ two: Math.round(three / SILVER_SHARE), three });
    const score = traps.total;
    // The finish is the run: crossing it is a star even with every trap missed.
    const stars = Math.max(1, drift_stars(score, { silver: marks.two, gold: marks.three }));
    const recorded = this.record({ stars, ms, score });
    this.result = {
      title: result_title(level.name, recorded),
      stars,
      lines: [
        line("traps", traps.kmh.map(kmh).join(" · ")),
        line("total", kmh(score)),
        ...time_lines(Math.round(this.elapsed()), this.hits, this.stewards),
        ...this.void_line(),
        line("length", `${((length * this.laps) / 1000).toFixed(1)} km`),
        line("par", format(par_thresholds(par_ms * this.laps).three)),
        line("★★ / ★★★", `${kmh(marks.two)} / ${kmh(marks.three)}`),
        best_line(track.runs[level.id], kmh),
      ],
    };
  }

  // A run with a cut, warned or not, sets no best.
  private record(run: StarRun): { improved: boolean; first: boolean } {
    if (this.stewards.cuts) return { improved: false, first: false };
    return this.ctx.track.record(this.level.id, run);
  }

  private void_line(): HTMLElement[] {
    return this.stewards.cuts ? [line("record", "not set: track limits")] : [];
  }

  finished(): Finish | null {
    return this.result;
  }

  ground_in(inside: (x: number, z: number) => boolean) {
    this.view.ground_in(inside);
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
  status: RACE_CAPTIONS,
  streams: true,
  score_text: kmh,
  levels: (world) => race_levels(world.routes, WORLDS[world.kind].map_label, world.tiles.streamed),
  start(ctx, level) {
    const route = ctx.world.routes.find((r) => r.id === (level.trap ?? level.id));
    if (!route) return null;
    const field = ctx.field();
    // Phase 3 is compact circuits: a streamed world holds ground only round the player, and rails glide where the field never drove.
    if (field && !level.trap && field_races(route, ctx.world.tiles.streamed, KINDS[ctx.world.kind].rails)) return new AiRace(ctx, field, level, race_course(route));
    return new Race(ctx, level, race_course(route));
  },
};
