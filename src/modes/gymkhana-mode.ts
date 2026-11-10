import { format } from "../hud/hud";
import type { World } from "../world/world";
import { GymRun, HIT_MS, LEVELS, MISS_MS, RunStatus, Step, build_course, find_site, type Course, type GymLevel, type Site } from "./gymkhana";
import { GymkhanaView } from "./gymkhana-view";
import { NO_SITE, body_of, type Driven, type Finish, type ModeCtx, type ModeDef, type ModeRun } from "./mode";
import { best_line, line, result_title } from "./result";

const sites = new WeakMap<World, Site | null>();

class Gymkhana implements ModeRun {
  private readonly view: GymkhanaView;
  private readonly run: GymRun;
  private result: Finish | null = null;

  constructor(
    private readonly ctx: ModeCtx,
    course: Course,
  ) {
    this.view = new GymkhanaView(course, ctx.world);
    ctx.scene.add(this.view.root);
    this.run = new GymRun(course);
    const { site } = course;
    ctx.spawn(site.x, site.z, site.heading);
  }

  update(sim_dt: number, car: Driven): string {
    const { run, view } = this;
    const { level } = run.course;
    const was = run.status;
    const hits = run.update(sim_dt * 1000, { x: car.pos.x, z: car.pos.z, heading: car.heading, speed: car.vel.length() }, body_of(car.spec));
    view.knock(hits);
    view.update(sim_dt);
    const step = run.step;
    view.target(step === Step.SPIN ? "spin" : step === Step.STOP ? "stop" : null);
    if (was !== RunStatus.DONE && run.status === RunStatus.DONE) this.finish(level);
    const doing =
      run.status === RunStatus.READY
        ? "cross the start line"
        : step === Step.SLALOM
          ? `slalom ${run.next + 1}/${run.course.sides.length}`
          : step === Step.SPIN
            ? "spin 180° in the box"
            : step === Step.STOP
              ? "stop in the box, facing back"
              : "done";
    const penalty = run.penalty_ms();
    return `${level.name} · ${format(run.total())}${penalty ? ` (+${penalty / 1000} s)` : ""} · ${doing}`;
  }

  private finish(level: GymLevel) {
    const { run } = this;
    const { track } = this.ctx;
    const stars = run.stars();
    const ms = Math.round(run.total());
    const recorded = track.record(level.id, { stars, ms });
    this.result = {
      title: result_title(level.name, recorded),
      stars,
      quiet: true,
      lines: [
        line("time", format(run.elapsed())),
        line(`cones ×${run.hits}`, `+${(run.hits * HIT_MS) / 1000} s`),
        line(`missed ×${run.misses}`, `+${(run.misses * MISS_MS) / 1000} s`),
        line("total", format(ms)),
        line("par", format(run.course.par_ms)),
        best_line(track.runs[level.id]),
      ],
    };
  }

  finished(): Finish | null {
    return this.result;
  }

  dispose() {
    this.view.dispose();
  }
}

export const GYMKHANA_MODE: ModeDef<GymLevel> = {
  id: "gymkhana",
  name: "Gymkhana",
  needs_ground: true,
  busy_notice: "Leave the lobby race to play gymkhana",
  levels: () => LEVELS,
  start(ctx, level) {
    if (!sites.has(ctx.world)) sites.set(ctx.world, find_site(ctx.world, ctx.start_index));
    const site = sites.get(ctx.world);
    return site ? new Gymkhana(ctx, build_course(ctx.world.seed, site, level)) : NO_SITE;
  },
};
