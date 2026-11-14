import { build_code, MAX_PAINT, parse_build, REWARD_PAINTS } from "../car/build";
import { CARS, is_car, type CarId, type Triple } from "../car/cars";
import { BUILD } from "../menu/update";
import { car_paints } from "../theme/palette";
import { export_block } from "./export";
import { load_notes, MAX_NOTES, NOTE_LENGTH, notes_key, pin_numbers, store_notes, type Note, type Notes } from "./notes";
import { OrbitInput, PadButton } from "./orbit-input";
import { blend_cam, snap_cam, SNAPS, type Frame, type Snap } from "./orbit";
import { viewer_build, viewer_presets, type ViewerPreset } from "./presets";
import type { Stage } from "./stage";
import { LIGHT_THEMES, settled_view, view_query, wrap_yaw, type Asked, type Cam, type ViewState } from "./view-state";

const FLY_S = 0.6;
const AUTO_DEG_S = 18;
const URL_MS = 300;
const SNAP_ORDER = Object.keys(SNAPS) as Snap[];

export const CAR_IDS = Object.keys(CARS).filter(is_car);
export const PAINTS = [...car_paints.keys(), ...Array.from({ length: REWARD_PAINTS }, (_, i) => MAX_PAINT + 1 + i)];

interface Fly {
  from: Cam;
  to: Cam;
  t: number;
}

export class Viewer {
  view: ViewState;
  notes = $state<Notes>({});
  auto = $state(false);
  pinning = $state(false);
  pending = $state<Triple | null>(null);
  picked = $state<number | null>(null);
  draft = $state("");
  panel = $state(true);
  /** The block when the browser refused the clipboard, shown to copy by hand. */
  refused = $state<string | null>(null);
  copied = $state<string | null>(null);
  readonly shot: boolean;
  private frame_box: Frame = { centre: [0, 0.6, 0], radius: 2.5 };
  private fly: Fly | null = null;
  private last_snap: Snap = "3/4";
  private dirty = true;
  private last = 0;
  private raf = 0;
  private url_timer = 0;
  private copied_timer = 0;
  private readonly input: OrbitInput;
  private readonly shot_pin: Asked["pin"];
  private readonly cam_asked: boolean;
  private sized = false;

  constructor(
    readonly stage: Stage,
    asked: Asked,
    fill: (frame: Frame, aspect: number) => ViewState,
  ) {
    this.shot = asked.shot;
    this.shot_pin = asked.pin;
    this.cam_asked = asked.view.cam !== undefined;
    this.notes = load_notes();
    this.view = $state(fill(this.frame_box, stage.aspect));
    this.frame_box = stage.show(this.view.code) ?? this.frame_box;
    this.input = new OrbitInput(stage.canvas, {
      cam: () => this.view.cam,
      move: (cam) => this.move(cam),
      tap: (x, y) => this.tap(x, y),
      settled: () => this.write_url(),
    });
  }

  start() {
    this.input.start();
    this.apply();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.input.stop();
    cancelAnimationFrame(this.raf);
    clearTimeout(this.url_timer);
  }

  get presets(): ViewerPreset[] {
    return viewer_presets(this.view.car);
  }

  get paint(): number {
    return parse_build(this.view.code)?.paint ?? 0;
  }

  get key(): string {
    return notes_key(this.view.car, this.view.preset);
  }

  get list(): Note[] {
    return this.notes[this.key] ?? [];
  }

  get numbers(): (number | null)[] {
    return pin_numbers(this.list);
  }

  get next_pin(): number {
    return this.numbers.filter((n) => n !== null).length + 1;
  }

  count(car: CarId): number {
    return Object.entries(this.notes).reduce((sum, [key, list]) => sum + (key.startsWith(`${car}/`) ? list.length : 0), 0);
  }

  pick_car(car: CarId) {
    if (car === this.view.car) return;
    const preset = viewer_presets(car).find((p) => p.id === this.view.preset) ?? viewer_presets(car)[0];
    this.set_build(car, preset, this.paint, true);
  }

  pick_preset(id: string) {
    const preset = this.presets.find((p) => p.id === id);
    if (preset) this.set_build(this.view.car, preset, this.paint, false);
  }

  pick_paint(paint: number) {
    const build = parse_build(this.view.code);
    if (!build) return;
    this.view = { ...this.view, code: build_code({ ...build, paint }) };
    this.apply();
  }

  set_steer(steer: number) {
    this.view = settled_view({ ...this.view, steer });
    this.stage.steer(this.view.steer);
    this.dirty = true;
    this.write_url();
  }

  private set_build(car: CarId, preset: ViewerPreset, paint: number, reframe: boolean) {
    const code = build_code(viewer_build(car, preset, paint));
    this.pending = null;
    this.picked = null;
    this.view = { ...this.view, car, preset: preset.id, code };
    this.apply();
    if (reframe) this.fly_to({ ...snap_cam("3/4", this.frame_box, this.stage.aspect, this.view.cam.fov), yaw: this.view.cam.yaw, pitch: this.view.cam.pitch });
  }

  private apply() {
    this.frame_box = this.stage.show(this.view.code) ?? this.frame_box;
    this.stage.steer(this.view.steer);
    this.marks();
    this.write_url();
  }

  marks() {
    if (this.shot) {
      this.stage.mark(this.shot_pin ? [{ at: this.shot_pin.at, n: this.shot_pin.n, picked: true }] : []);
    } else {
      const numbers = this.numbers;
      const pins = this.list.flatMap((note, i) => (note.pin ? [{ at: note.pin, n: numbers[i] ?? 0, picked: this.picked === i }] : []));
      if (this.pending) pins.push({ at: this.pending, n: this.next_pin, picked: true });
      this.stage.mark(pins);
    }
    this.dirty = true;
  }

  snap(snap: Snap) {
    this.auto = false;
    this.fly_to(snap_cam(snap, this.frame_box, this.stage.aspect, this.view.cam.fov));
  }

  reset() {
    this.set_steer(0);
    this.snap("3/4");
  }

  private fly_to(to: Cam) {
    this.fly = { from: this.view.cam, to, t: 0 };
    this.dirty = true;
  }

  private move(cam: Cam) {
    this.fly = null;
    this.view = { ...this.view, cam: { ...cam, yaw: wrap_yaw(cam.yaw) } };
    this.dirty = true;
  }

  private tap(x: number, y: number) {
    if (!this.pinning) return;
    const at = this.stage.hit(x, y);
    if (!at) return;
    this.pending = at;
    this.pinning = false;
    this.picked = null;
    this.panel = true;
    this.marks();
  }

  add() {
    const text = this.draft.trim().slice(0, NOTE_LENGTH);
    if (!text && !this.pending) return;
    const note: Note = { text, pin: this.pending, view: settled_view(this.view) };
    const list = [...this.list, note].slice(-MAX_NOTES);
    this.notes = { ...this.notes, [this.key]: list };
    this.draft = "";
    this.pending = null;
    this.picked = list.length - 1;
    this.save();
  }

  edit(index: number, text: string) {
    const list = this.list.map((note, i) => (i === index ? { ...note, text: text.slice(0, NOTE_LENGTH) } : note));
    this.notes = { ...this.notes, [this.key]: list };
    this.save();
  }

  remove(index: number) {
    const list = this.list.filter((_, i) => i !== index);
    const notes = { ...this.notes };
    if (list.length) notes[this.key] = list;
    else delete notes[this.key];
    this.notes = notes;
    this.picked = null;
    this.save();
  }

  cancel_pin() {
    this.pending = null;
    this.pinning = false;
    this.marks();
  }

  /** Flies back to the view `index` was written at: its paint, steer and camera; the light only by a reload. */
  go(index: number) {
    const note = this.list[index];
    if (!note) return;
    this.picked = index;
    this.auto = false;
    if (note.view.light !== this.view.light) {
      this.relight(note.view.light, note.view);
      return;
    }
    this.view = { ...this.view, code: note.view.code, steer: note.view.steer };
    this.apply();
    this.fly_to(note.view.cam);
  }

  private save() {
    store_notes(this.notes);
    this.marks();
  }

  /** The palette is read once per page load, so the light comes from the theme the page loads with. */
  relight(light: ViewState["light"], view: ViewState = this.view) {
    location.replace(`${view_query({ ...view, light })}&theme=${encodeURIComponent(LIGHT_THEMES[light])}`);
  }

  async copy(car: CarId | null) {
    const block = export_block(this.notes, BUILD.version, { width: innerWidth, height: innerHeight }, new Date(), car);
    try {
      await navigator.clipboard.writeText(block);
      this.refused = null;
      this.copied = car ?? "all";
      clearTimeout(this.copied_timer);
      this.copied_timer = window.setTimeout(() => (this.copied = null), 1600);
    } catch (error) {
      console.warn("cars: clipboard refused", error);
      this.refused = block;
    }
  }

  /** The current view as a link: the URL bar always holds it, so a copied address opens this exact picture. */
  private write_url() {
    clearTimeout(this.url_timer);
    this.url_timer = window.setTimeout(() => {
      const keep = new URLSearchParams(location.search).get("theme");
      const theme = keep ? `&theme=${encodeURIComponent(keep)}` : "";
      history.replaceState(null, "", `${view_query(settled_view(this.view))}${theme}${this.shot ? "&shot" : ""}${location.hash}`);
    }, URL_MS);
  }

  private readonly loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 0);
    this.last = now;
    for (const button of this.input.pad(dt)) this.on_pad(button);
    if (this.fly) {
      this.fly.t += dt / FLY_S;
      const done = this.fly.t >= 1;
      this.view = { ...this.view, cam: done ? this.fly.to : blend_cam(this.fly.from, this.fly.to, this.fly.t) };
      if (done) {
        this.fly = null;
        this.write_url();
      }
      this.dirty = true;
    } else if (this.auto) {
      this.view = { ...this.view, cam: { ...this.view.cam, yaw: wrap_yaw(this.view.cam.yaw + AUTO_DEG_S * dt) } };
      this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.stage.render(this.view.cam);
    if (!this.fly && this.sized) document.documentElement.dataset.cars = "ready";
  };

  private on_pad(button: number) {
    const at = SNAP_ORDER.findIndex((snap) => snap === this.last_snap);
    if (button === PadButton.LB || button === PadButton.RB) {
      const next = SNAP_ORDER[(at + (button === PadButton.RB ? 1 : SNAP_ORDER.length - 1)) % SNAP_ORDER.length];
      this.last_snap = next;
      this.snap(next);
    } else if (button === PadButton.Y) this.reset();
    else if (button === PadButton.X) this.auto = !this.auto;
  }

  resized(width: number, height: number) {
    this.stage.resize(width, height);
    // The first view is framed before the canvas has its size: an unasked camera is framed again once it does.
    if (!this.sized && !this.cam_asked) this.view = { ...this.view, cam: snap_cam("3/4", this.frame_box, this.stage.aspect, this.view.cam.fov) };
    this.sized = true;
    this.dirty = true;
  }
}
