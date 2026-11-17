import type * as THREE from "three";
import { hypot } from "../sim-math";
import { rgba } from "../theme/palette";
import type { World } from "../world/world";
import { chunk_of } from "../worldgen/chunk-grid";
import { KINDS } from "../worldgen/kinds/kinds";
import type { CareerEvent } from "./career";
import type { Career } from "./career-store";
import { GateCard, type GateHost } from "./gate-card.svelte";
import { MarkerView, banner_primer, marker_tone } from "./marker-view";
import { arrival, event_markers, marker_at, marker_open, MARKER_REACH, type MapMarker, type Marker, type Pose } from "./markers";

const NONE: readonly MapMarker[] = [];
// Driving past a flag at speed, a lap past the start line on Sky Track included, never pops the card.
const SLOW = 5;

export class EventMarkers {
  readonly card: GateCard;
  on_map: ((markers: readonly MapMarker[]) => void) | null = null;
  private markers: readonly Marker[] = [];
  /** One per marker, built once the ground under it is in; null until then. */
  private views: (MarkerView | null)[] = [];
  private world: World | null = null;
  private placed = false;
  private icons: readonly MapMarker[] = NONE;
  private shown: readonly MapMarker[] | null = null;
  private drawn = -1;
  private at: Marker | null = null;
  /** The flag Go last put the car before, and where: its card opens there until the car, once there, drives off. */
  private arrived: { marker: Marker; x: number; z: number; reached: boolean } | null = null;
  private readonly open = (marker: Marker) => marker_open(marker, this.career.stars, this.tune);
  private readonly primer = banner_primer();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly career: Career,
    private readonly tune: boolean,
    gate: GateHost,
  ) {
    this.card = new GateCard(gate);
    scene.add(this.primer);
  }

  /** The restart action at a flag: starts its event when the card offers it. */
  start_here(): boolean {
    const { at } = this;
    if (!at || !this.open(at)) return false;
    this.card.start();
    return true;
  }

  /** An event's flag on this map; null until it is placed. */
  flag(id: string): Marker | null {
    return this.markers.find((one) => one.event.id === id) ?? null;
  }

  /** Where Go puts the car for `marker`, read once the ground around it is in; its card opens there. */
  arrive(marker: Marker): Pose {
    const { world } = this;
    const at = world ? arrival(marker, KINDS[world.kind].open_ground, (x, z, fx, fz) => world.spawn_near(x, z, fx, fz)) : marker;
    this.arrived = { marker, x: at.x, z: at.z, reached: false };
    return at;
  }

  // A compact world's gymkhana and parking sites read terrain anywhere, so its flags wait for the whole map. A streamed
  // world runs only route modes, whose starts need no terrain: each flag goes up once the chunk under it streams in.
  async place(world: World, start_index: number, events: readonly CareerEvent[]) {
    if (!events.length) return;
    if (!world.tiles.streamed) await world.tiles.whole();
    this.markers = event_markers(world, start_index, events, KINDS[world.kind].open_ground);
    this.views = this.markers.map(() => null);
    this.world = world;
    this.placed = true;
  }

  get map_markers(): readonly MapMarker[] {
    return this.shown ?? NONE;
  }

  /** `speed` in m/s. */
  update(x: number, z: number, speed: number, idle: boolean) {
    const { career, open, views, world } = this;
    if (!this.placed || !world) return;
    for (let i = 0; i < views.length; i++) if (!views[i]) views[i] = this.raise(world, i);
    if (career.version !== this.drawn) {
      this.drawn = career.version;
      for (const view of views) view?.show(open);
      this.icons = this.markers.map((m) => ({ label: m.event.id, x: m.x, z: m.z, ink: rgba(marker_tone(m, open(m))) }));
      this.shown = null;
    }
    for (const view of views) if (view) view.root.visible = idle;
    const icons = idle ? this.icons : NONE;
    if (icons !== this.shown) {
      this.shown = icons;
      this.on_map?.(icons);
    }
    const held = this.held(x, z);
    const at = idle && speed < SLOW ? (marker_at(this.markers, x, z) ?? held) : null;
    this.at = at;
    this.card.show(at, at !== null && open(at), career.stars);
  }

  // The sim takes a frame to move the car to the arrival spot, so only leaving it after being there lets go.
  private held(x: number, z: number): Marker | null {
    const { arrived } = this;
    if (!arrived) return null;
    const there = hypot(arrived.x - x, arrived.z - z) <= MARKER_REACH;
    if (there) arrived.reached = true;
    else if (arrived.reached) this.arrived = null;
    return there ? arrived.marker : null;
  }

  // A dropped chunk keeps its flag: the ground it stands on never changes, and it sits out in the fog by then.
  private raise(world: World, i: number): MarkerView | null {
    const marker = this.markers[i];
    const { tiles } = world;
    if (tiles.streamed && !tiles.get(chunk_of(marker.x, marker.z, tiles.ext))) return null;
    const view = new MarkerView([marker], (x, z) => world.height(x, z) + world.drawn_lift(x, z));
    view.show(this.open);
    this.scene.add(view.root);
    return view;
  }

  dispose() {
    for (const view of this.views) view?.dispose();
    this.views = [];
    this.primer.removeFromParent();
    this.primer.geometry.dispose();
    this.card.dispose();
  }
}
