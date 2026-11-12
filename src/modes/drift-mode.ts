import { format } from "../hud/hud";
import { ROAD_HALF } from "../world/world";
import { ComboEnd, DRIFT_LEVELS, DriftRun, DriftStatus, LEAD, build_zone, drift_stars, type DriftLevel, type Zone } from "./drift";
import { DriftView } from "./drift-view";
import { body_of, type Driven, type Finish, type ModeCtx, type ModeDef, type ModeRun } from "./mode";
import { best_line, line, points, result_title } from "./result";

const LOST_MS = 1500;

class Drift implements ModeRun {
  private readonly view: DriftView;
  private readonly run: DriftRun;
  private lost_at = -Infinity;
  private result: Finish | null = null;

  constructor(
    private readonly ctx: ModeCtx,
    zone: Zone,
  ) {
    this.view = new DriftView(zone, ctx.world);
    ctx.scene.add(this.view.root);
    this.run = new DriftRun(zone, ctx.world.solids);
    ctx.spawn_on(zone.points[0]);
  }

  update(sim_dt: number, car: Driven): string {
    const { run } = this;
    const was = run.status;
    const end = run.update(sim_dt * 1000, { x: car.pos.x, z: car.pos.z, heading: car.heading, vx: car.vel.x, vz: car.vel.z }, body_of(car.spec), ROAD_HALF);
    if (end === ComboEnd.LOST) this.lost_at = run.clock;
    if (was !== DriftStatus.DONE && run.status === DriftStatus.DONE) this.finish();
    const { level } = run.zone;
    const { combo } = run;
    if (run.status === DriftStatus.READY) return `${level.name} · zone in ${Math.round((LEAD - Math.max(0, run.tracker.index)) * 2)} m`;
    const live = combo.chain > 0 ? ` · ×${combo.mult} +${points(combo.chain)}` : run.clock - this.lost_at < LOST_MS ? " · wall, combo lost" : "";
    return `${level.name} · ${points(combo.score)} pts${live}`;
  }

  private finish() {
    const { run } = this;
    const { zone, combo } = run;
    const { level } = zone;
    const { track } = this.ctx;
    const marks = this.ctx.thresholds({ two: zone.silver, three: zone.gold });
    const stars = drift_stars(combo.score, { silver: marks.two, gold: marks.three });
    const score = Math.round(combo.score);
    const recorded = track.record(level.id, { stars, ms: Math.max(1, Math.round(run.elapsed())), score });
    this.result = {
      title: run.timed_out ? `${level.name} · time up` : result_title(level.name, recorded),
      stars,
      lines: [
        line("score", points(score)),
        line("best chain", points(combo.best_chain)),
        line("walls", String(combo.lost)),
        line("time", format(run.elapsed())),
        line("★★ / ★★★", `${points(marks.two)} / ${points(marks.three)}`),
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

export const DRIFT_MODE: ModeDef<DriftLevel> = {
  id: "drift",
  name: "Drift zones",
  needs_ground: false,
  car_sized_only: false,
  busy_notice: "Leave the lobby race to drift",
  levels: () => DRIFT_LEVELS,
  start: (ctx, level) => new Drift(ctx, build_zone(ctx.world.seed, ctx.world.road, level)),
};
