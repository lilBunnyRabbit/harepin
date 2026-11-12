import { format } from "../hud/hud";
import { HUNT_LEVELS, HuntRun, HuntStatus, build_hunt, type Hunt, type HuntLevel } from "./hunt";
import type { Hits } from "./hits";
import { HuntView } from "./hunt-view";
import { turn_to, type Driven, type Finish, type ModeCtx, type ModeDef, type ModeRun } from "./mode";
import { best_line, line, penalty_text, result_title, time_lines } from "./result";
import { grade, par_thresholds } from "./track";

class GateHunt implements ModeRun {
  private readonly view: HuntView;
  private readonly run: HuntRun;
  private result: Finish | null = null;
  private readonly hits: Hits | null;

  constructor(
    private readonly ctx: ModeCtx,
    hunt: Hunt,
  ) {
    this.view = new HuntView(hunt, ctx.world);
    ctx.scene.add(this.view.root);
    this.run = new HuntRun(hunt);
    this.hits = ctx.hits();
  }

  update(sim_dt: number, car: Driven): string | null {
    const { run, view, ctx } = this;
    const was = run.status;
    const hit = run.update(sim_dt * 1000, car.pos.x, car.pos.z, car.vel.x, car.vel.z);
    this.hits?.update(sim_dt * 1000, run.status === HuntStatus.RUNNING || was === HuntStatus.RUNNING);
    if (hit >= 0) {
      view.found(hit);
      if (run.status !== HuntStatus.DONE) ctx.chime();
    }
    if (was !== HuntStatus.DONE && run.status === HuntStatus.DONE) {
      ctx.hide_hint();
      this.finish();
      return null;
    }
    const next = run.nearest(car.pos.x, car.pos.z);
    view.aim(next);
    view.update(sim_dt);
    const gate = run.hunt.gates[next];
    const { gates, level } = run.hunt;
    if (!gate) return null;
    ctx.hint(turn_to(car, gate.x, gate.z));
    const doing = run.status === HuntStatus.READY ? "drive to start the clock" : `${format(run.elapsed())}${penalty_text(this.hits)}`;
    return `${level.name} · ${run.found.size}/${gates.length} · ${doing} · ${Math.round(Math.hypot(gate.x - car.pos.x, gate.z - car.pos.z))} m`;
  }

  private finish() {
    const { run } = this;
    const { level, par_ms, gates } = run.hunt;
    const { track } = this.ctx;
    const time = Math.round(run.elapsed());
    const ms = time + (this.hits?.penalty_ms ?? 0);
    const par = this.ctx.thresholds(par_thresholds(par_ms));
    const stars = grade(run.elapsed() + (this.hits?.penalty_ms ?? 0), par);
    const recorded = track.record(level.id, { stars, ms });
    this.result = {
      title: result_title(level.name, recorded),
      stars,
      lines: [...time_lines(time, this.hits), line("gates", String(gates.length)), line("par", format(par.three)), best_line(track.runs[level.id])],
    };
  }

  finished(): Finish | null {
    return this.result;
  }

  dispose() {
    this.view.dispose();
  }
}

export const HUNT_MODE: ModeDef<HuntLevel> = {
  id: "hunt",
  name: "Gate hunt",
  needs_ground: true,
  car_sized_only: false,
  busy_notice: "Leave the lobby race to hunt gates",
  levels: () => HUNT_LEVELS,
  start(ctx, level) {
    const { world } = ctx;
    const from = world.road[(ctx.start_index + world.road.length) % world.road.length];
    const run = new GateHunt(ctx, build_hunt(world.seed, world, from, level));
    ctx.spawn_on(from);
    return run;
  },
};
