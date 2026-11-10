import * as THREE from "three";
import { Ghost } from "../car/ghost";
import { format } from "../hud/hud";
import type { World } from "../world/world";
import { world_key } from "../worldgen/kinds/kinds";
import { DUEL_LEVELS, DuelRun, DuelStatus, build_route, type DuelLevel, type Route } from "./duel";
import { DuelView } from "./duel-view";
import type { Driven, Finish, ModeCtx, ModeDef, ModeRun } from "./mode";
import { best_line, line, result_title } from "./result";

const ghosts = new WeakMap<World, { id: string; ghost: Ghost }>();

function ghost_for(ctx: ModeCtx, id: string): Ghost {
  const { world } = ctx;
  const kept = ghosts.get(world);
  if (kept?.id === id) return kept.ghost;
  kept?.ghost.dispose();
  const ghost = new Ghost(ctx.scene, world.seed, `harepin:ghost:duel:${id}:${world_key(world.seed, world.kind)}`);
  ghosts.set(world, { id, ghost });
  return ghost;
}

class Duel implements ModeRun {
  private readonly view: DuelView;
  private readonly run: DuelRun;
  private readonly ghost: Ghost;
  private readonly ghost_at = new THREE.Vector3();
  private result: Finish | null = null;

  constructor(
    private readonly ctx: ModeCtx,
    route: Route,
  ) {
    this.view = new DuelView(route, ctx.world);
    ctx.scene.add(this.view.root);
    this.ghost = ghost_for(ctx, route.level.id);
    this.ghost.start();
    this.run = new DuelRun(route);
    ctx.spawn_on(route.points[0]);
  }

  update(sim_dt: number, car: Driven): string | null {
    const { run, ghost } = this;
    const was = run.status;
    run.update(sim_dt * 1000, car.pos.x, car.pos.z);
    const running = run.status === DuelStatus.RUNNING;
    if (running && sim_dt > 0) ghost.record(run.elapsed(), car);
    ghost.update(running ? run.elapsed() : null, this.ctx.camera.position);
    if (was !== DuelStatus.DONE && run.status === DuelStatus.DONE) {
      ghost.record(run.elapsed(), car);
      this.finish();
      return null;
    }
    const { level } = run.route;
    if (run.status === DuelStatus.READY) {
      const to_line = Math.max(0, Math.round(-run.route.at[Math.max(0, run.tracker.index)]));
      return `${level.name} · start line in ${to_line} m${ghost.has_best ? "" : " · this run sets your ghost"}`;
    }
    const gap = run.gap(ghost.position(run.elapsed(), this.ghost_at));
    const versus = gap === null ? (ghost.has_best ? "ghost finished" : "no ghost yet") : `${gap >= 0 ? "ahead" : "behind"} ${Math.abs(Math.round(gap))} m`;
    return `${level.name} · ${format(run.elapsed())} · ${versus}`;
  }

  private finish() {
    const { run } = this;
    const { level, par_ms } = run.route;
    const { track } = this.ctx;
    const stars = run.stars();
    const ms = Math.round(run.elapsed());
    const before = track.runs[level.id];
    const recorded = track.record(level.id, { stars, ms });
    this.ghost.finish(recorded.improved);
    const versus = !before ? "new ghost" : `${ms <= before.ms ? "−" : "+"}${(Math.abs(before.ms - ms) / 1000).toFixed(2)} s`;
    this.result = {
      title: result_title(level.name, recorded),
      stars,
      lines: [line("time", format(ms)), line("vs ghost", versus), line("par", format(par_ms)), best_line(track.runs[level.id])],
    };
  }

  finished(): Finish | null {
    return this.result;
  }

  dispose() {
    this.view.dispose();
    this.ghost.update(null, this.ctx.camera.position);
  }
}

export const DUEL_MODE: ModeDef<DuelLevel> = {
  id: "duel",
  name: "Ghost duel",
  needs_ground: false,
  car_sized_only: false,
  busy_notice: "Leave the lobby race to duel your ghost",
  levels: () => DUEL_LEVELS,
  start(ctx, level) {
    const { world } = ctx;
    const route = build_route(world.seed, world.road, level, (index) => world.clear_spawn(index));
    return new Duel(ctx, route);
  },
};
