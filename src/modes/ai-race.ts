import { build_spec, type Build } from "../car/build";
import { CARS } from "../car/cars";
import { FieldView } from "../ai/field-view";
import { field_builds } from "../ai/field-pick";
import { at_difficulty } from "../ai/difficulty";
import { field_personalities, grid_spot } from "../ai/field";
import { Standings } from "../ai/standings";
import { format } from "../hud/hud";
import { ordinal } from "../career/series";
import { FieldTally } from "./field-tally";
import { turn_to, type Driven, type FieldHost, type FieldPlace, type FieldRace, type Finish, type ModeCtx, type ModeRun, type RouteRun } from "./mode";
import { RaceLights } from "./race-lights";
import { RaceView } from "./race-view";
import { COUNTDOWN_MS, RaceRun, RaceStatus, type RaceCourse, type RaceLevel } from "./races";
import { line } from "./result";

/** D4: about four minutes a race, in laps of the route's par; an island circuit's one lap already takes that (D3's three laps do not fit). */
const RACE_MS = 240_000;
const MAX_LAPS = 3;
/** Places that show two stars; nothing is recorded, as position grading is its own design (O9). */
const PODIUM = 3;
const PLAYER = "You";

const End = { LINE: "line", OUT: "out", TIME: "time" } as const;
type End = (typeof End)[keyof typeof End];

const seconds = (s: number) => `${s.toFixed(1)} s`;

interface Row {
  el: HTMLElement;
  place: HTMLElement;
  name: HTMLElement;
  time: HTMLElement;
  /** The car and finish time the row shows, -1 and NaN before it shows one. */
  car: number;
  done: number;
}

export class AiRace implements ModeRun, FieldRace {
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
  private readonly laps: number;
  private banked = 0;
  /** s since the go: the player's race clock until they finish, then on for the cars still racing. */
  private t = 0;
  private go_at = -1;
  private result: Finish | null = null;
  private rows: Row[] = [];
  private readonly tally: FieldTally;
  /** The order a knockout or a timed race ended on; a race to the line keeps filling in as the cars cross it. */
  private final: number[] | null = null;
  private touches = 0;
  private touched = false;
  private led = false;
  private halfway = false;
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
    // A timed race runs the most laps a field may, so no car stops at the line before the clock does.
    this.laps = host.event?.limit_ms ? MAX_LAPS : Math.max(1, Math.min(MAX_LAPS, Math.round(RACE_MS / route.par_ms)));
    this.builds = field_builds(host.build(), host.rating(), host.cars.length, route.excludes);
    this.names = [...this.builds.map((b, i) => host.event?.names[i] ?? `${CARS[b.car].name} ${b.number}`), PLAYER];
    this.run = this.grid_run();
    this.standings = new Standings(this.builds.length + 1, route.points.length, this.laps, this.builds.length);
    this.tally = new FieldTally(this.builds.length + 1, route.points.length, this.laps, host.event?.knockout === true);
    this.route = { id: route.id, gate: this.run.gate, later: this.later(0), respawn: course.line[0] };
    const spot = grid_spot(route, this.builds.length);
    ctx.spawn(spot.x, spot.z, spot.heading);
    host.attach?.(this);
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
    this.host.sim.send({ type: "field", route: route.id, specs: this.builds.map(build_spec), traits: at_difficulty(field_personalities(world.seed, this.host.cars.slice(0, count)), this.host.difficulty()), seed: world.seed, laps: this.laps, drive_rival: this.host.autopilot });
    this.field = new FieldView(this.ctx.scene, this.host.sim, this.builds);
    this.touches = this.host.sim.field_touches;
  }

  // Touches during the countdown or after the line do not count against a clean race.
  private count_touches(running: boolean) {
    const now = this.host.sim.field_touches;
    if (running && now > this.touches) this.touched = true;
    this.touches = now;
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
    this.count_touches(!this.result && run.status !== RaceStatus.READY);
    if (!this.result) this.check_halfway();
    if (!this.result && this.ends()) {
      this.route.gate = null;
      ctx.hide_hint();
      view.guide(0, 0);
      return null;
    }
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
      if (this.lap < this.laps) {
        this.banked += run.elapsed();
        this.lap++;
        ctx.chime();
        this.next_lap();
      } else this.finish(End.LINE);
      return null;
    }
    const gate = run.gate;
    this.route.gate = gate;
    if (!gate) return null;
    view.guide(run.tracker.index, this.course.gates[run.next]);
    ctx.hint(turn_to(car, gate.x, gate.z));
    const name = this.name;
    const field = this.builds.length + 1;
    if (run.status === RaceStatus.READY) return `${name} · ${Math.ceil(run.countdown / 1000)} · ${field} on the grid`;
    const place = this.place_now();
    const doing = run.missed ? "missed a gate, go back" : this.doing();
    return `${name} · ${format(this.banked + run.elapsed())} · P${place}/${this.tally.left()}${this.gap_text(place)} · ${doing}`;
  }

  /** A knockout or the clock ends the player's race before the line: true once it has. */
  private ends(): boolean {
    const player = this.builds.length;
    const event = this.host.event;
    const out = this.tally.update(this.t, this.host.sim.field_progress, this.standings.order);
    if (out === player || (event?.knockout && this.tally.left() === 1)) this.finish(End.OUT);
    else if (event?.limit_ms && this.t * 1000 >= event.limit_ms) this.finish(End.TIME);
    return this.result !== null;
  }

  // Scored once, as the player first passes half the race's road points.
  private check_halfway() {
    if (this.halfway) return;
    const at = this.host.sim.field_progress[this.builds.length];
    if (!(at >= (this.course.route.points.length * this.laps) / 2)) return;
    this.halfway = true;
    this.led = this.place_now() === 1;
  }

  // A knockout's place counts only the cars still in.
  private place_now(): number {
    const player = this.builds.length;
    let place = 0;
    for (const car of this.standings.order) {
      if (this.tally.is_out(car)) continue;
      place++;
      if (car === player) break;
    }
    return place;
  }

  private doing(): string {
    const limit = this.host.event?.limit_ms;
    if (limit) return `${format(Math.max(0, limit - this.t * 1000))} left`;
    return `lap ${this.lap}/${this.laps}`;
  }

  private get name(): string {
    return this.host.event?.name ?? this.level.name;
  }

  private gap_text(place: number): string {
    const { standings } = this;
    const player = this.builds.length;
    if (this.tally.out.length) return "";
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

  private finish(end: End) {
    const player = this.builds.length;
    const ms = Math.round(this.banked + this.run.elapsed());
    if (end === End.LINE) {
      this.t = ms / 1000;
      this.standings.finished(player, this.t);
      if (this.tally.out.length) this.final = this.tally.final_order(this.standings.order);
    } else this.final = this.tally.final_order(this.standings.order);
    const order = this.final ?? this.standings.order;
    const place = order.indexOf(player) + 1;
    const field = this.builds.length + 1;
    this.rows = order.map(() => this.row());
    this.write_rows();
    const how = end === End.OUT && place > 1 ? `Out in ${ordinal(place)}` : end === End.TIME ? `${ordinal(place)} at the flag` : `${ordinal(place)} of ${field}`;
    // The player always takes the last grid slot (`grid_spot` puts the field on 0..n-1).
    const extra = this.host.event?.finish({ order, clean: !this.touched, led: this.led, fastest: this.laps > 1 && this.tally.fastest(player), from_back: true }) ?? [];
    const laps = end === End.LINE ? line("laps", String(this.laps)) : line("laps done", String(this.lap - 1));
    this.result = {
      title: `${how} · ${this.name}`,
      stars: place === 1 ? 3 : place <= PODIUM ? 2 : 1,
      lines: [line("time", format(ms)), laps, ...extra],
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
    return { el, place, name, time, car: -1, done: NaN };
  }

  // AI cars still racing when the player finishes fill their times in as they cross the line.
  private write_rows() {
    const { standings, rows } = this;
    const order = this.final ?? standings.order;
    const leader = standings.finish[order[0]];
    for (let i = 0; i < order.length; i++) {
      const car = order[i];
      const row = rows[i];
      const done = standings.finish[car];
      if (row.car === car && row.done === done) continue;
      row.car = car;
      row.done = done;
      row.el.dataset.now = String(car === this.builds.length);
      row.place.textContent = String(i + 1);
      row.name.textContent = this.names[car];
      row.time.textContent = this.tally.is_out(car) ? "out" : done === Infinity ? (this.final ? "--" : "racing") : i === 0 ? format(done * 1000) : `+${seconds(done - leader)}`;
    }
  }

  finished(): Finish | null {
    return this.result;
  }

  get done(): boolean {
    return this.result !== null;
  }

  places(): FieldPlace[] {
    const { standings } = this;
    const order = standings.order;
    const leader = order[0];
    return order.map((car) => ({ car, you: car === this.builds.length, name: this.names[car], finish: standings.finish[car], gap: car === leader ? 0 : standings.gap(leader, car, this.t) }));
  }

  dispose() {
    this.host.attach?.(null);
    this.field?.dispose();
    this.lights.hide();
    this.unplace();
    this.view.dispose();
  }
}
