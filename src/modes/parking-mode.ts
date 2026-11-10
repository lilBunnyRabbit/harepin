import { format } from "../hud/hud";
import type { World } from "../world/world";
import { find_site, to_world, type Site } from "./gymkhana";
import { NO_SITE, body_of, type Driven, type Finish, type ModeCtx, type ModeDef, type ModeRun } from "./mode";
import { PARK_LEVELS, ParkRun, ParkStatus, Verdict, park_footprint, park_solids, type ParkLevel } from "./parking";
import { ParkingView } from "./parking-view";
import { best_line, line, result_title } from "./result";

const DEG = 180 / Math.PI;
const AREA = park_footprint();
const sites = new WeakMap<World, Site | null>();

class Parking implements ModeRun {
  private readonly view: ParkingView;
  private readonly unplace: () => void;
  private readonly run: ParkRun;
  private result: Finish | null = null;

  constructor(
    private readonly ctx: ModeCtx,
    site: Site,
    level: ParkLevel,
  ) {
    const { world } = ctx;
    this.view = new ParkingView(site, level, world, world.seed, AREA);
    ctx.scene.add(this.view.root);
    const solids = park_solids(site, level, (x, z) => world.height(x, z));
    this.unplace = world.place(solids);
    this.run = new ParkRun(site, level, solids);
    const at = to_world(site, level.start.u, level.start.v);
    ctx.spawn(at.x, at.z, site.heading + level.start.heading);
  }

  update(sim_dt: number, car: Driven): string {
    const { run } = this;
    const was = run.status;
    run.update(sim_dt * 1000, { x: car.pos.x, z: car.pos.z, heading: car.heading, speed: car.vel.length() }, body_of(car.spec));
    const verdict = run.last.verdict;
    this.view.inside(verdict === Verdict.INSIDE);
    if (was !== ParkStatus.DONE && run.status === ParkStatus.DONE) this.finish();
    const doing =
      run.status === ParkStatus.READY
        ? `park in the marked bay · C ${this.ctx.high() ? "chase" : "high"} view`
        : run.status === ParkStatus.DONE
          ? "parked"
          : verdict === Verdict.INSIDE
            ? run.held > 0
              ? "hold it"
              : "stop to park"
            : verdict === Verdict.BACKWARDS
              ? "facing the wrong way"
              : verdict === Verdict.CROOKED
                ? "straighten up"
                : "park in the marked bay";
    const touches = run.touches ? ` · touches ${run.touches}` : "";
    return `${run.level.name} · ${format(run.elapsed())}${touches} · ${doing}`;
  }

  private finish() {
    const { run } = this;
    const { level } = run;
    const { track } = this.ctx;
    const stars = run.stars();
    const result = run.result();
    const ms = Math.round(result.ms);
    const recorded = track.record(level.id, { stars, ms });
    this.result = {
      title: result_title(level.name, recorded),
      stars,
      quiet: true,
      lines: [
        line("time", format(ms)),
        line("par", format(level.par_ms)),
        line("touches", String(result.touches)),
        line("angle", `${(result.angle * DEG).toFixed(1)}°`),
        line("off centre", `${result.offset.toFixed(2)} m`),
        best_line(track.runs[level.id]),
      ],
    };
  }

  finished(): Finish | null {
    return this.result;
  }

  dispose() {
    this.view.dispose();
    this.unplace();
  }
}

export const PARKING_MODE: ModeDef<ParkLevel> = {
  id: "parking",
  name: "Parking",
  needs_ground: true,
  busy_notice: "Leave the lobby race to park",
  high_view: true,
  levels: () => PARK_LEVELS,
  start(ctx, level) {
    if (!sites.has(ctx.world)) sites.set(ctx.world, find_site(ctx.world, ctx.start_index, AREA));
    const site = sites.get(ctx.world);
    return site ? new Parking(ctx, site, level) : NO_SITE;
  },
};
