import { build_code, MAX_PAINT, parse_build, REWARD_PAINTS, type Slot } from "../car/build";
import { CARS, is_car, type CarId, type Triple } from "../car/cars";
import { BUILD } from "../menu/update";
import { car_paints } from "../theme/palette";
import { export_block } from "./export";
import type { WorldKind } from "../worldgen/types";
import { ASSET_LOOKS } from "./asset-looks";
import { ASSETS, AssetKind, is_part, type Asset, type WorldAsset } from "./assets";
import { load_notes, MAX_NOTES, NOTE_LENGTH, pin_numbers, store_notes, type Note, type Notes } from "./notes";
import { OrbitInput, PadButton } from "./orbit-input";
import { blend_cam, snap_cam, SNAPS, type Frame, type Snap } from "./orbit";
import { viewer_build, viewer_presets, type ViewerPreset } from "./presets";
import type { Stage } from "./stage";
import { asset_ref, LIGHT_THEMES, settled_view, view_key, view_query, wrap_yaw, type Asked, type Cam, type ViewState } from "./view-state";

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
    stage.lights(this.lamps);
    this.frame_box = stage.show(this.view) ?? this.frame_box;
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
    return view_key(this.view);
  }

  get kind(): AssetKind {
    return this.view.asset?.kind ?? AssetKind.CAR;
  }

  get world(): WorldAsset | null {
    const asset = this.view.asset;
    return asset && "world" in asset ? asset : null;
  }

  /** The car stands, as itself or carrying the part the view names. */
  get car_shown(): boolean {
    const asset = this.view.asset;
    return !asset || ("on" in asset && asset.on);
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

  /** Notes on a car and its parts, or on one world kind's assets. */
  count(id: string): number {
    return Object.values(this.notes).reduce((sum, list) => sum + (list.length && asset_ref(list[0].view).id === id ? list.length : 0), 0);
  }

  count_key(view: ViewState): number {
    return this.notes[view_key(view)]?.length ?? 0;
  }

  pick_asset(kind: AssetKind) {
    if (kind === this.kind) return;
    this.set_asset(this.asset_for(kind), true);
  }

  private asset_for(kind: AssetKind): Asset | undefined {
    if (kind === AssetKind.CAR) return undefined;
    if (is_part(kind)) return { kind, on: false };
    const look = ASSET_LOOKS[kind];
    const worlds = look.worlds();
    const world = this.world && worlds.includes(this.world.world) ? this.world.world : worlds[0];
    const seed = ASSETS[kind].seeded ? (this.world?.seed || 1) : 0;
    return this.world_asset(kind, world, seed, null);
  }

  private world_asset(kind: AssetKind, world: WorldKind, seed: number, item: string | null): WorldAsset | undefined {
    if (kind === AssetKind.CAR || is_part(kind)) return undefined;
    const items = ASSET_LOOKS[kind].items(world, seed);
    const keep = items.find((pick) => pick.id === item) ?? items[0];
    return { kind, world, seed, item: keep?.id ?? "none" };
  }

  pick_world(world: WorldKind) {
    const at = this.world;
    if (at && at.world !== world) this.set_asset(this.world_asset(at.kind, world, at.seed, null), true);
  }

  pick_item(item: string) {
    const at = this.world;
    if (at && at.item !== item) this.set_asset({ ...at, item }, true);
  }

  pick_seed(seed: number) {
    const at = this.world;
    if (at && ASSETS[at.kind].seeded && Number.isInteger(seed) && seed >= 0 && seed !== at.seed) this.set_asset(this.world_asset(at.kind, at.world, seed, at.item), true);
  }

  toggle_on() {
    const asset = this.view.asset;
    if (asset && "on" in asset) this.set_asset({ ...asset, on: !asset.on }, false);
  }

  /** A part slot the wheels show (tyres, brakes): it rewrites the build code, as paint does, and keeps the preset. */
  pick_part(slot: Slot, index: number) {
    const build = parse_build(this.view.code);
    if (!build || build.parts[slot] === index) return;
    this.view = { ...this.view, code: build_code({ ...build, parts: { ...build.parts, [slot]: index } }) };
    this.apply();
  }

  private set_asset(asset: Asset | undefined, reframe: boolean) {
    this.pending = null;
    this.picked = null;
    const view = { ...this.view };
    if (asset) view.asset = asset;
    else delete view.asset;
    this.view = view;
    this.apply();
    if (reframe) this.reframe();
  }

  private reframe() {
    this.fly_to({ ...snap_cam("3/4", this.frame_box, this.stage.aspect, this.view.cam.fov), yaw: this.view.cam.yaw, pitch: this.view.cam.pitch });
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

  get lamps(): boolean {
    return this.view.lamps ?? true;
  }

  toggle_lights() {
    this.view = { ...this.view, lamps: !this.lamps };
    this.stage.lights(this.lamps);
    this.dirty = true;
    this.write_url();
  }

  private set_build(car: CarId, preset: ViewerPreset, paint: number, reframe: boolean) {
    const code = build_code(viewer_build(car, preset, paint));
    this.pending = null;
    this.picked = null;
    this.view = { ...this.view, car, preset: preset.id, code };
    this.apply();
    if (reframe) this.reframe();
  }

  private apply() {
    this.frame_box = this.stage.show(this.view) ?? this.frame_box;
    this.stage.lights(this.lamps);
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
    const world = note.view.asset && "world" in note.view.asset;
    const view: ViewState = { ...this.view, ...(world ? {} : { car: note.view.car, preset: note.view.preset, code: note.view.code }), steer: note.view.steer, lamps: note.view.lamps };
    if (note.view.asset) view.asset = note.view.asset;
    else delete view.asset;
    this.view = view;
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

  async copy(id: string | null) {
    const block = export_block(this.notes, BUILD.version, { width: innerWidth, height: innerHeight }, new Date(), id);
    try {
      await navigator.clipboard.writeText(block);
      this.refused = null;
      this.copied = id ?? "all";
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
    if (this.stage.swing(now / 1000)) this.dirty = true;
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
