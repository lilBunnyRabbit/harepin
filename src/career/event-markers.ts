import type * as THREE from "three";
import { rgba } from "../theme/palette";
import type { World } from "../world/world";
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
  private view: MarkerView | null = null;
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

  // A streamed world gets none until its modes run (career.md C7).
  async place(world: World, start_index: number, events: readonly CareerEvent[]) {
    if (world.tiles.streamed || !events.length) return;
    await world.tiles.whole();
    this.markers = event_markers(world, start_index, events, KINDS[world.kind].open_ground);
    this.view = new MarkerView(this.markers, (x, z) => world.height(x, z));
    this.scene.add(this.view.root);
  }

  get map_markers(): readonly MapMarker[] {
    return this.shown ?? NONE;
  }

  /** `speed` in m/s. */
  update(x: number, z: number, speed: number, idle: boolean) {
    const { view, career, open } = this;
    if (!view) return;
    if (career.version !== this.drawn) {
      this.drawn = career.version;
      view.show(open);
      this.icons = this.markers.map((m) => ({ label: m.event.id, x: m.x, z: m.z, ink: rgba(marker_tone(m, open(m))) }));
      this.shown = null;
    }
    view.root.visible = idle;
    const icons = idle ? this.icons : NONE;
    if (icons !== this.shown) {
      this.shown = icons;
      this.on_map?.(icons);
    }
    const at = idle && speed < SLOW ? marker_at(this.markers, x, z) : null;
    this.at = at;
    this.card.show(at, at !== null && open(at), career.stars);
  }

  dispose() {
    this.view?.dispose();
    this.view = null;
  }
}
