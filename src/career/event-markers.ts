import type * as THREE from "three";
import { rgba } from "../theme/palette";
import type { World } from "../world/world";
import { chunk_of } from "../worldgen/chunk-grid";
import { KINDS } from "../worldgen/kinds/kinds";
import type { CareerEvent } from "./career";
import type { Career } from "./career-store";
import { MarkerCard } from "./marker-card";
import { MarkerView, marker_tone } from "./marker-view";
import { event_markers, marker_at, marker_open, type MapMarker, type Marker } from "./markers";

const NONE: readonly MapMarker[] = [];
// Driving past a flag at speed, a lap past the start line on Sky Track included, never pops the card.
const SLOW = 5;

export class EventMarkers {
  readonly card: MarkerCard;
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
  private readonly open = (marker: Marker) => marker_open(marker, this.career.stars, this.tune);

  constructor(
    private readonly scene: THREE.Scene,
    private readonly career: Career,
    private readonly tune: boolean,
    private readonly on_start: (id: string) => void,
  ) {
    this.card = new MarkerCard(on_start);
  }

  /** The restart action at a flag: starts its event when the card offers it. */
  start_here(): boolean {
    const { at } = this;
    if (!at || !this.open(at)) return false;
    this.on_start(at.event.id);
    return true;
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
    const at = idle && speed < SLOW ? marker_at(this.markers, x, z) : null;
    this.at = at;
    this.card.show(at, at !== null && open(at), career.stars);
  }

  // A dropped chunk keeps its flag: the ground it stands on never changes, and it sits out in the fog by then.
  private raise(world: World, i: number): MarkerView | null {
    const marker = this.markers[i];
    const { tiles } = world;
    if (tiles.streamed && !tiles.get(chunk_of(marker.x, marker.z, tiles.ext))) return null;
    const view = new MarkerView([marker], (x, z) => world.height(x, z));
    view.show(this.open);
    this.scene.add(view.root);
    return view;
  }

  dispose() {
    for (const view of this.views) view?.dispose();
    this.views = [];
  }
}
