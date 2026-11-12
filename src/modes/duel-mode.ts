import * as THREE from "three";
import { Ghost } from "../car/ghost";
import { format } from "../hud/hud";
import { ROAD_HALF, type World } from "../world/world";
import { DUEL_LEAD, DUEL_LEVELS, DuelRun, DuelStatus, build_route, duel_gates, type DuelLevel, type Route } from "./duel";
import type { Hits } from "./hits";
import { CIRCUIT, turn_to, type Driven, type Finish, type ModeCtx, type ModeDef, type ModeRun, type RouteRun } from "./mode";
import { RaceView } from "./race-view";
import { best_line, line, penalty_text, result_title, time_lines } from "./result";
import { grade, par_thresholds } from "./track";

const ghosts = new WeakMap<World, { key: string; ghost: Ghost }>();

function ghost_for(ctx: ModeCtx, id: string): Ghost {
  const { world } = ctx;
  const key = `harepin:ghost:${ctx.track.scope}:${id}:${world.key}`;
  const kept = ghosts.get(world);
  if (kept?.key === key) return kept.ghost;
  kept?.ghost.dispose();
  const ghost = new Ghost(ctx.scene, world.seed, key);
  ghosts.set(world, { key, ghost });
  return ghost;
}

class Duel implements ModeRun {
  private readonly view: RaceView;
  private readonly run: DuelRun;
  private readonly ghost: Ghost;
  private readonly ghost_at = new THREE.Vector3();
  private result: Finish | null = null;
  private readonly hits: Hits | null;
  readonly route: RouteRun;

  constructor(
    private readonly ctx: ModeCtx,
    route: Route,
  ) {
    const gates = duel_gates(route, ctx.world.checkpoints);
    const circuit = ctx.world.routes.find((r) => r.id === CIRCUIT);
    const line = route.points.slice(DUEL_LEAD);
    this.view = new RaceView({ line, gates: gates.map((at) => at - DUEL_LEAD), route: { closed: false, gate_hw: circuit?.gate_hw ?? ROAD_HALF, closure: [] } }, ctx.world);
    ctx.scene.add(this.view.root);
    const ghost = ghost_for(ctx, route.level.id);
    this.ghost = ghost;
    ghost.start();
    // An event's own dev ghost races the player until their first finish replaces it.
    if (!ghost.has_best) void ctx.dev_ghost().then((lap) => lap && !ghost.has_best && ghost.use(lap));
    this.run = new DuelRun(route, gates);
    this.hits = ctx.hits();
    this.route = { id: CIRCUIT, gate: this.run.gate, later: this.later(), respawn: route.points[0] };
    ctx.spawn_on(route.points[0]);
  }

  private later(): RouteRun["later"] {
    const { route, gates, next } = this.run;
    return gates.slice(next + 1).map((at) => route.points[at]);
  }

  update(sim_dt: number, car: Driven): string | null {
    const { run, ghost, view, ctx } = this;
    const was = run.status;
    const taken = run.update(sim_dt * 1000, car.pos.x, car.pos.z);
    this.hits?.update(sim_dt * 1000, run.status === DuelStatus.RUNNING || was === DuelStatus.RUNNING);
    const running = run.status === DuelStatus.RUNNING;
    if (running && sim_dt > 0) ghost.record(run.elapsed(), car);
    ghost.update(running ? run.elapsed() : null, this.ctx.camera.position);
    view.update(sim_dt);
    if (taken >= 0) {
      this.route.respawn = run.route.points[run.gates[taken]];
      this.route.later = this.later();
      view.aim(run.next);
      if (run.status !== DuelStatus.DONE) ctx.chime();
    }
    if (was !== DuelStatus.DONE && run.status === DuelStatus.DONE) {
      this.route.gate = null;
      ctx.hide_hint();
      view.guide(0, 0);
      ghost.record(run.elapsed(), car);
      this.finish();
      return null;
    }
    const gate = run.gate;
    this.route.gate = gate;
    if (!gate) return null;
    view.guide(Math.max(0, run.tracker.index - DUEL_LEAD), run.gates[run.next] - DUEL_LEAD);
    ctx.hint(turn_to(car, gate.x, gate.z));
    const { level } = run.route;
    if (run.status === DuelStatus.READY) {
      const to_line = Math.max(0, Math.round(-run.route.at[Math.max(0, run.tracker.index)]));
      return `${level.name} · start line in ${to_line} m${ghost.has_best ? "" : " · this run sets your ghost"}`;
    }
    const gap = run.gap(ghost.position(run.elapsed(), this.ghost_at));
    const versus = gap === null ? (ghost.has_best ? "ghost finished" : "no ghost yet") : `${gap >= 0 ? "ahead" : "behind"} ${Math.abs(Math.round(gap))} m`;
    return `${level.name} · ${format(run.elapsed())}${penalty_text(this.hits)} · ${versus}`;
  }

  private finish() {
    const { run } = this;
    const { level, par_ms } = run.route;
    const { track } = this.ctx;
    const time = Math.round(run.elapsed());
    const ms = time + (this.hits?.penalty_ms ?? 0);
    const par = this.ctx.thresholds(par_thresholds(par_ms));
    const stars = grade(run.elapsed() + (this.hits?.penalty_ms ?? 0), par);
    const before = track.runs[level.id];
    const against = before?.ms ?? this.ghost.best_ms;
    const recorded = track.record(level.id, { stars, ms });
    this.ghost.finish(recorded.improved);
    const versus = against === null ? "new ghost" : `${ms <= against ? "−" : "+"}${(Math.abs(against - ms) / 1000).toFixed(2)} s`;
    this.result = {
      title: result_title(level.name, recorded),
      stars,
      lines: [...time_lines(time, this.hits), line("vs ghost", versus), line("par", format(par.three)), best_line(track.runs[level.id])],
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
  goal: "Drive the circuit from the start line and beat the ghost.",
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
