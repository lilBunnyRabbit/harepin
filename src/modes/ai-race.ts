import { build_spec, type Build } from "../car/build";
import { CARS } from "../car/cars";
import { FieldView } from "../ai/field-view";
import { field_builds } from "../ai/field-pick";
import { grid_spot, personalities } from "../ai/field";
import { Standings } from "../ai/standings";
import { format } from "../hud/hud";
import { turn_to, type Driven, type FieldHost, type Finish, type ModeCtx, type ModeRun, type RouteRun } from "./mode";
import { RaceLights } from "./race-lights";
import { RaceView } from "./race-view";
import { COUNTDOWN_MS, RaceRun, RaceStatus, type RaceCourse, type RaceLevel } from "./races";
import { line } from "./result";

/** F3: six AI and the player; D3: three laps. */
const AI_CARS = 6;
const AI_LAPS = 3;
/** Places that show two stars; nothing is recorded, as position grading is its own design (O9). */
const PODIUM = 3;
const PLAYER = "You";

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;
const seconds = (s: number) => `${s.toFixed(1)} s`;

interface Row {
  el: HTMLElement;
  place: HTMLElement;
  name: HTMLElement;
  time: HTMLElement;
  key: string;
}

export class AiRace implements ModeRun {
  private readonly view: RaceView;
  private readonly unplace: () => void;
  private readonly lights = new RaceLights();
  private readonly builds: Build[];
  private readonly names: string[];
  private run: RaceRun;
  private field: FieldView | null = null;
  private standings: Standings;
  private wall = 0;
  private lap = 1;
  private banked = 0;
  /** s since the go: the player's race clock until they finish, then on for the cars still racing. */
  private t = 0;
  private go_at = -1;
  private result: Finish | null = null;
  private rows: Row[] = [];
  readonly route: RouteRun;

  constructor(
    private readonly ctx: ModeCtx,
    private readonly host: FieldHost,
    private readonly level: RaceLevel,
    private readonly course: RaceCourse,
  ) {
    const { route } = course;
    this.view = new RaceView(course, ctx.ground);
    ctx.scene.add(this.view.root);
    this.unplace = ctx.world.place(route.closure);
    this.builds = field_builds(host.build(), AI_CARS, route.excludes);
    this.names = [...this.builds.map((b) => `${CARS[b.car].name} ${b.number}`), PLAYER];
    this.run = this.grid_run();
    this.standings = new Standings(this.builds.length + 1, route.points.length, AI_LAPS, this.builds.length);
    this.route = { id: route.id, gate: this.run.gate, later: this.later(0), respawn: course.line[0] };
    const spot = grid_spot(route, this.builds.length);
    ctx.spawn(spot.x, spot.z, spot.heading);
  }

  // The grid stands behind the line, near the end of a lap: from index 0, the tracker never reads it as a lap done.
  private grid_run(): RaceRun {
    const run = new RaceRun(this.course, COUNTDOWN_MS);
    run.tracker.index = 0;
    return run;
  }

  private later(next: number): RouteRun["later"] {
    const { line, gates } = this.course;
    return gates.slice(next + 1).map((at) => line[at]);
  }

  get holding(): boolean {
    return this.run.countdown > 0;
  }

  /** Sent on the first update, once the player's car stands on its slot in the sim: the field tracks it from there. */
  private start_field() {
    const { route } = this.course;
    const { world } = this.ctx;
    const count = this.builds.length;
    this.host.sim.send({ type: "field", route: route.id, specs: this.builds.map(build_spec), traits: personalities(world.seed, count), seed: world.seed, laps: AI_LAPS, drive_rival: this.host.autopilot });
    this.field = new FieldView(this.ctx.scene, this.host.sim, this.builds);
  }

  update(sim_dt: number, car: Driven): string | null {
    if (!this.field) this.start_field();
    const { run, view, ctx } = this;
    const now = performance.now();
    const wall = this.wall ? now - this.wall : 0;
    this.wall = now;
    const was = run.status;
    const taken = run.update(run.countdown > 0 ? wall : sim_dt * 1000, car.pos.x, car.pos.z);
    if (this.go_at < 0 && run.status !== RaceStatus.READY) this.go_at = now;
    this.lights.update(run.countdown, this.go_at < 0 ? -1 : now - this.go_at);
    this.field?.update(ctx.camera);
    view.update(sim_dt);
    const player = this.builds.length;
    this.t = this.result ? this.t + sim_dt : (this.banked + run.elapsed()) / 1000;
    this.standings.update(this.t, this.host.sim.field_progress);
    if (this.result) this.write_rows();
    if (taken >= 0) {
      this.route.respawn = this.course.line[this.course.gates[taken]];
      this.route.later = this.later(run.next);
      view.aim(run.next);
      if (run.status !== RaceStatus.DONE) ctx.chime();
    }
    if (was !== RaceStatus.DONE && run.status === RaceStatus.DONE) {
      this.route.gate = null;
      ctx.hide_hint();
      view.guide(0, 0);
      if (this.lap < AI_LAPS) {
        this.banked += run.elapsed();
        this.lap++;
        ctx.chime();
        this.next_lap();
      } else this.finish(player);
      return null;
    }
    const gate = run.gate;
    this.route.gate = gate;
    if (!gate) return null;
    view.guide(run.tracker.index, this.course.gates[run.next]);
    ctx.hint(turn_to(car, gate.x, gate.z));
    const { name } = this.level;
    const field = this.builds.length + 1;
    if (run.status === RaceStatus.READY) return `${name} · ${Math.ceil(run.countdown / 1000)} · ${field} on the grid`;
    const place = this.standings.place(player);
    const doing = run.missed ? "missed a gate, go back" : `lap ${this.lap}/${AI_LAPS}`;
    return `${name} · ${format(this.banked + run.elapsed())} · P${place}/${field}${this.gap_text(place)} · ${doing}`;
  }

  private gap_text(place: number): string {
    const { standings } = this;
    const player = this.builds.length;
    const order = standings.order;
    const gap = place > 1 ? standings.gap(order[place - 2], player, this.t) : standings.gap(player, order[1], this.t);
    if (Number.isNaN(gap)) return "";
    return place > 1 ? ` · +${seconds(gap)}` : ` · lead ${seconds(gap)}`;
  }

  private next_lap() {
    this.run = new RaceRun(this.course, 0);
    this.route.respawn = this.course.line[0];
    this.view.aim(0);
    this.route.later = this.later(0);
  }

  private finish(player: number) {
    const ms = Math.round(this.banked + this.run.elapsed());
    this.t = ms / 1000;
    this.standings.finished(player, this.t);
    const place = this.standings.place(player);
    const field = this.builds.length + 1;
    this.rows = this.standings.order.map(() => this.row());
    this.write_rows();
    this.result = {
      title: `${ordinal(place)} of ${field} · ${this.level.name}`,
      stars: place === 1 ? 3 : place <= PODIUM ? 2 : 1,
      lines: [line("time", format(ms)), line("laps", String(AI_LAPS))],
      standings: this.rows.map((r) => r.el),
    };
  }

  private row(): Row {
    const el = document.createElement("li");
    const place = document.createElement("span");
    place.className = "dim";
    const name = document.createElement("span");
    const time = document.createElement("b");
    el.append(place, name, time, document.createElement("span"));
    return { el, place, name, time, key: "" };
  }

  // AI cars still racing when the player finishes fill their times in as they cross the line.
  private write_rows() {
    const { standings } = this;
    const order = standings.order;
    const leader = standings.finish[order[0]];
    order.forEach((car, i) => {
      const row = this.rows[i];
      const done = standings.finish[car];
      const time = done === Infinity ? "racing" : i === 0 ? format(done * 1000) : `+${seconds(done - leader)}`;
      const key = `${car}:${time}`;
      if (key === row.key) return;
      row.key = key;
      row.el.dataset.now = String(car === this.builds.length);
      row.place.textContent = String(i + 1);
      row.name.textContent = this.names[car];
      row.time.textContent = time;
    });
  }

  finished(): Finish | null {
    return this.result;
  }

  dispose() {
    this.field?.dispose();
    this.lights.hide();
    this.unplace();
    this.view.dispose();
  }
}
