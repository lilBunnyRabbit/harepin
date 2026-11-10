import type { Caught } from "../hud/input";
import type { DirectoryStatus, Server } from "../net/directory";
import type { Player } from "../net/players";
import type { ModeEntry } from "../modes/modes";
import type { RaceChoice } from "../modes/races";
import type { ReadyStatus } from "../net/ready";
import type { Rows, Value } from "./setting-rows";
import { world_query } from "../world/world-pick";
import { DEFAULT_KIND } from "../worldgen/kinds/kinds";
import type { WorldKind } from "../worldgen/types";
import type { Laps, QualityTier, SettingKey, SettingsState } from "./prefs";

export const MenuTab = {
  PLAY: "play",
  GARAGE: "garage",
  ONLINE: "online",
  SETTINGS: "settings",
} as const;
export type MenuTab = (typeof MenuTab)[keyof typeof MenuTab];

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
  name(): string;
  quality_status(): QualityStatus;
  race_busy(): boolean;
  toggle_race(laps: Laps, route: string): void;
  race_ready(): boolean;
  toggle_ready(laps: Laps, route: string): void;
  /** Re-sends a standing ready with a new pick; nothing when not ready. */
  repick_ready(laps: Laps, route: string): void;
  ready_status(): ReadyStatus;
  readonly version: string;
  /** Every release, newest first: the What's new page. */
  changelog(): HTMLElement;
  /** A new version waits on What's new: the top bar shows its chip. */
  update_ready(): boolean;
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
  /** The garage's own element: the Garage tab shows it, and `show_garage` starts and stops it with the tab. */
  readonly garage_stage: HTMLElement;
  show_garage(on: boolean): void;
  mode_list(): ModeEntry[];
  play_level(id: string): void;
  mode_active(): boolean;
  free_drive(): void;
  lobby_record(): string;
  readonly race_routes: readonly RaceChoice[];
  players(): number;
  restart_lap(): void;
  /** Hands the next key or pad button press to `on` for a binding; null stops. */
  listen(on: ((caught: Caught | null) => void) | null): void;
}

export interface Menu {
  readonly host: SettingsHost;
  readonly rows: Rows;
  state(): SettingsState;
  set<K extends SettingKey>(key: K, value: SettingsState[K]): void;
  /** Runs on every refresh: live text, checked states. */
  sync(run: () => void): void;
  refresh(): void;
  close(): void;
  show(section: string): void;
  /** A world the player picked: remembered for the next bare load, then driven in this room. */
  drive(seed: number, kind: WorldKind): void;
  go(query: Record<string, string>): void;
}

export interface SettingsMenu extends Menu {
  /** A row's binding to one setting. */
  value<K extends SettingKey>(key: K): Value<SettingsState[K]>;
  show_sub(id: string): void;
  /** Reload without the URL param, after a change the page only applies on load. */
  reload(param: string): void;
  redraw_help(): void;
}

export interface MenuPage {
  readonly id: string;
  readonly label: string;
  /** Set on a full-screen page: Back returns to this tab and the header shows `label`. */
  readonly parent?: MenuTab;
  build(): HTMLElement[];
  on_show?(): void;
  on_hide?(): void;
}

export function invite_link(room: string, seed: number, kind: WorldKind = DEFAULT_KIND): string {
  return `${location.origin}${location.pathname}?${new URLSearchParams(world_query(room, seed, kind))}`;
}
