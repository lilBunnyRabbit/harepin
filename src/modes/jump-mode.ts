import type { World } from "../world/world";
import { JumpEvent, JumpRun, TRIES, build_jump, jump_levels, jump_stars, metres, type Jump, type JumpLevel, type JumpPose } from "./jump";
import { JumpView } from "./jump-view";
import { CIRCUIT, airborne, type Driven, type Finish, type ModeCtx, type ModeDef, type ModeRun, type RouteRun } from "./mode";
import { best_line, line, result_title } from "./result";

const NO_RAMP = "No ramp of this kind on this map";

export function jump_at(world: World, start_index: number, level: JumpLevel): Jump | null {
  const n = world.road.length;
  const at = world.road[((start_index % n) + n) % n];
  return at ? build_jump(world.ramps, at, world, level, world.challenges) : null;
}

class JumpDistance implements ModeRun {
  private readonly view: JumpView;
  private readonly run: JumpRun;
  private result: Finish | null = null;
  private readonly pose: JumpPose = { x: 0, z: 0, vx: 0, vz: 0, airborne: false };
  readonly route: RouteRun;

  constructor(
    private readonly ctx: ModeCtx,
    private readonly jump: Jump,
  ) {
    this.view = new JumpView(jump, ctx.ground);
    ctx.scene.add(this.view.root);
    this.run = new JumpRun(jump);
    this.route = { id: CIRCUIT, gate: jump.lip, later: [], respawn: jump.start };
    ctx.spawn_on(jump.start);
  }

  update(sim_dt: number, car: Driven): string {
    const { run, jump } = this;
    const { name } = jump.level;
    const { pose } = this;
    pose.x = car.pos.x;
    pose.z = car.pos.z;
    pose.vx = car.vel.x;
    pose.vz = car.vel.z;
    pose.airborne = airborne(car);
    const event = run.update(sim_dt * 1000, pose);
    if (event === JumpEvent.LANDED) {
      const last = run.tries[run.tries.length - 1];
      this.view.land(last, last === run.best);
    }
    if (event === JumpEvent.RESET) this.ctx.spawn_on(jump.start);
    if (event === JumpEvent.DONE) this.finish();
    if (run.done) return `${name} · ${run.best ? metres(run.best.metres) : "no jump"}`;
    const settling = run.settling;
    if (settling) return `${name} · ${metres(settling.metres)}${settling === run.best ? " · best" : ""}`;
    if (run.flying !== null) return `${name} · ${metres(run.flying)}`;
    const best = run.best ? ` · best ${metres(run.best.metres)}` : "";
    return `${name} · try ${run.tries.length + 1}/${TRIES}${best} · ${Math.ceil(run.left_ms / 1000)} s`;
  }

  private finish() {
    const { run, jump } = this;
    const { level } = jump;
    const { track } = this.ctx;
    const marks = this.ctx.thresholds(jump.marks);
    const score = run.best?.metres ?? 0;
    const stars = jump_stars(score, marks);
    const recorded = track.record(level.id, { stars, ms: Math.max(1, Math.round(run.clock)), score });
    this.result = {
      title: run.timed_out && !run.best ? `${level.name} · time up` : result_title(level.name, recorded),
      stars,
      lines: [
        line("distance", run.best ? metres(run.best.metres) : "--"),
        line("tries", run.tries.map((t) => metres(t.metres)).join(" · ") || "--"),
        line("★★ / ★★★", `${metres(marks.two)} / ${metres(marks.three)}`),
        best_line(track.runs[level.id], metres),
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

export const JUMP_MODE: ModeDef<JumpLevel> = {
  id: "jump",
  name: "Jump distance",
  goal: `Hit the ramp flat out: the longest of ${TRIES} jumps counts.`,
  needs_ground: false,
  car_sized_only: false,
  busy_notice: "Leave the lobby race to jump",
  score_text: metres,
  levels: (world) => jump_levels(world.ramps, world.challenges, world),
  start: (ctx, level) => {
    const jump = jump_at(ctx.world, ctx.start_index, level);
    return jump ? new JumpDistance(ctx, jump) : NO_RAMP;
  },
};
