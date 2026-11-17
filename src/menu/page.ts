import type { Caught } from "../hud/input";
import type { DirectoryStatus, Server } from "../net/directory";
import type { Player } from "../net/players";
import type { Career } from "../career/career-store";
import type { Series } from "../career/series-store";
import type { Runs } from "../runs/runs-store";
import type { Board } from "../runs/daily-board";
import type { MapMarker } from "../career/markers";
import type { Goals } from "../goals/goals";
import type { Garage } from "./garage.svelte";
import type { ModeEntry } from "../modes/modes";
import type { RaceChoice } from "../modes/races";
import type { ReadyStatus } from "../net/ready";
import type { UpdateState } from "../version";
import { world_query } from "../world/world-pick";
import { DEFAULT_KIND } from "../worldgen/types";
import type { WorldKind } from "../worldgen/types";
import type { MapPlayer } from "./world-map.svelte";
import type { Laps, QualityTier, SettingKey, SettingsState } from "./prefs";
import type { Tab } from "./ui/types";

export const MenuTab = {
  PLAY: "play",
  EVENTS: "career",
  GARAGE: "garage",
  ONLINE: "online",
  SETTINGS: "settings",
  SUPPORT: "support",
} as const;
export type MenuTab = (typeof MenuTab)[keyof typeof MenuTab];

export const STATIONS: readonly Tab<MenuTab>[] = [
  { id: MenuTab.PLAY, label: "Home" },
  { id: MenuTab.EVENTS, label: "Events" },
  { id: MenuTab.GARAGE, label: "Garage" },
  { id: MenuTab.ONLINE, label: "Online" },
  { id: MenuTab.SETTINGS, label: "Settings" },
];

/** Where Back leads from a station. */
export const ROAD = "Road";

export interface QualityStatus {
  tier: QualityTier;
  ratio: number;
  bloom: boolean;
  /** Sun shadow map size in px, 0 when off. */
  shadow_size: number;
}

export interface SettingsHost {
  readonly room: string;
  readonly seed: number;
  readonly kind: WorldKind;
  readonly levels: readonly number[];
  /** This map's code when it is a custom one; null for the plain map. */
  readonly code: string | null;
  /** Why this load is not on the map it was sent to: a code it can't read, or settings with no drivable build. */
  readonly map_note: string | null;
  /** The loaded map by name: "Island · Harwar". */
  map_name(): string;
  readonly goals: Goals;
  readonly career: Career;
  /** Starts a career event now on this map, or reloads onto its map. */
  start_event(id: string): void;
  /** The Harepin Series, one entry per season in `SEASONS` order. */
  readonly series: readonly Series[];
  /** Starts a series event now on this map, or reloads onto its map. */
  start_series(id: string): void;
  readonly runs: Runs;
  /** Starts a `?run=` pick now on this map, or reloads onto its map. */
  start_run(id: string): void;
  name(): string;
  quality_status(): QualityStatus;
  race_busy(): boolean;
  toggle_race(laps: Laps, route: string): void;
  race_ready(): boolean;
  toggle_ready(laps: Laps, route: string): void;
  /** Re-sends a standing ready with a new pick; nothing when not ready. */
  repick_ready(laps: Laps, route: string): void;
  ready_status(): ReadyStatus;
  /** The route leaves out the car being driven. */
  race_left_out(route: string): boolean;
  readonly version: string;
  /** Every release, newest first: the What's new page. */
  changelog(): HTMLElement;
  /** What's new on its list of releases, never on a story left open. */
  show_updates(): void;
  /** The menu closed: What's new opens on its list next time. */
  updates_closed(): void;
  /** A new version is downloading or waits on What's new: the top bar shows its chip. */
  update_state(): UpdateState;
  servers(): Server[];
  servers_status(): DirectoryStatus;
  /** This room's handshake failed on the password, so its row offers another try. */
  password_failed(): boolean;
  browse_servers(on: boolean): void;
  /** Everyone in the directory, this player first; filled while `browse_servers` is on. */
  players_online(): Player[];
  /** `Net.status`: online, searching, connecting, or why it can't connect. */
  net_status(): string;
  /** Peers linked in this room, on any map. */
  peers(): number;
  /** Room peers whose cars this build can't show, by which side is out of date. */
  version_peers(): { older: number; newer: number };
  /** Today's daily times: room peers' and the ones cached today, on this build's pick, the fastest first. */
  daily_board(): Board;
  readonly garage: Garage;
  car_code(): string;
  use_car(code: string): void;
  mode_list(): ModeEntry[];
  play_level(id: string): void;
  mode_running(): string | null;
  quit_mode(): void;
  lobby_record(): string;
  readonly race_routes: readonly RaceChoice[];
  players(): number;
  /** You and the cars on this map, for the world map. */
  map_players(): MapPlayer[];
  /** Career event starts on this map, for the world map. */
  map_markers(): readonly MapMarker[];
  restart_lap(): void;
  /** Hands the next key or pad button press to `on` for a binding; null stops. */
  listen(on: ((caught: Caught | null) => void) | null): void;
}

export interface Menu {
  readonly host: SettingsHost;
  state(): SettingsState;
  set<K extends SettingKey>(key: K, value: SettingsState[K]): void;
  /** Runs on every refresh: live text, checked states. */
  sync(run: () => void): void;
  refresh(): void;
  close(): void;
  show(section: string): void;
  /** One level up: to the page this one was opened from, else its station; a station closes the menu. */
  back(): void;
  /** The name of the place `back` leads to from `section`, for its Back pill. */
  up_of(section: string): string;
  /** A world the player picked: remembered for the next bare load, then driven in this room. */
  drive(seed: number, kind: WorldKind, levels?: readonly number[]): void;
  go(query: Record<string, string>): void;
}

/**
 * How a full-screen page sits under its Back and title. `column`: a centred panel, the head over it. `wide`: full width,
 * no panel, as tall as its content. `fill`: full width, no panel, the screen's height. `fill-panel`: the screen in one
 * panel, as tall as its content on a phone. `stage`: the screen's height with no Back bar; the page draws its own way out.
 * `frame`: a rebuilt page, which draws itself in `MenuFrame` as every station does; the layouts before it go with the last old page.
 */
export type PageLayout = "column" | "wide" | "fill" | "fill-panel" | "stage" | "frame";

export interface MenuPage {
  readonly id: string;
  readonly label: string;
  /** Set on a full-screen page: Back returns to this tab and the header shows `label`. */
  readonly parent?: MenuTab;
  /** A full-screen page's layout; `column` when unset. */
  readonly layout?: PageLayout;
  build(): HTMLElement[];
  on_show?(): void;
  on_hide?(): void;
  /** B / Esc / phone Back on this page: true when the page took it a level up itself. */
  back?(): boolean;
}

export function invite_link(room: string, seed: number, kind: WorldKind = DEFAULT_KIND, code: string | null = null): string {
  return `${location.origin}${location.pathname}?${new URLSearchParams(world_query(room, seed, kind, code))}`;
}
