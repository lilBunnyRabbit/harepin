import { joinRoom, type Room } from "trystero";
import { APP_ID, RateLimit, clean_name, type RoomLock, type RosterEntry } from "./net";
import { DIRECTORY_ROOM, ROOM_LENGTH, clean_room } from "./room-name";
import { MAX_SEED } from "./seed";
import { TURN_SERVERS } from "./ice";
import { WorldKind } from "../worldgen/types";
import { world_id } from "../worldgen/kinds/kinds";
import { clean_map_code } from "../worldgen/kinds/map-code";
import { clean_country } from "./country";
import { player_list, type Player } from "./players";

const ANNOUNCE_MS = 3000;
// About three missed announces, plus slack for a late timer in a background tab.
const EXPIRE_MS = ANNOUNCE_MS * 3 + 1000;
// Long enough for a relay round trip and a WebRTC handshake on a slow phone.
const EMPTY_AFTER_MS = 12_000;
// Past this many directory links a peer turns new ones away, so a busy directory can't swamp a phone.
const MAX_PEERS = 24;
// Leaders watching for the HUD count take at most this many of those links, so players browsing the list always fit.
const MAX_WATCHERS = 16;
export const PASSWORD_LENGTH = 64;
const MAX_PLAYERS = 64;
// Keeps one announce well under MAX_RECEIVE_BYTES; a bigger game lists its first players and counts the rest.
const MAX_ROSTER = 16;
const VERSION = /^[0-9A-Za-z.+-]{1,24}$/;
const PING_MS = 4000;
const ANNOUNCE_GAP_MS = 1000;
const ANNOUNCE_BURST = 6;
const MAX_RECEIVE_BYTES = 16 * 1024;
const LOCK_KEY = "harepin:room-password";
const LOCK_CODE = 4;
// Only a locked room gets this ending, so an unlocked game under such a name is a no-password visitor in someone's
// locked room and stays out of the list instead of showing as a joinable twin.
const LOCKED_NAME = new RegExp(`~[0-9a-z]{${LOCK_CODE}}$`);

// A type alias, not an interface: trystero's DataPayload needs the implicit index signature only aliases get.
export type Announce = {
  room: string;
  seed: number;
  host: string;
  players: number;
  locked: boolean;
  version: string;
  /** `map_id` of the game's map; peers that predate it send none and are on the island. */
  world?: number;
  /** The code of a custom map; absent on a plain one. */
  map?: string;
  /** In a lobby race, so not joinable until it ends; peers that predate it send none. */
  racing?: boolean;
  /** The game's players, its announcer first; peers that predate it send none and show as one row under `host`. */
  roster?: RosterEntry[];
};

export interface Server extends Announce {
  key: string;
  here: boolean;
  /** Directory peer id of the announcer; empty for this game. */
  peer: string;
}

interface Entry {
  announce: Announce;
  seen: number;
}

type Mode = "off" | "announce" | "listen";

export const DirectoryStatus = {
  CONNECTING: "connecting",
  ONLINE: "online",
  OFFLINE: "offline",
} as const;
export type DirectoryStatus = (typeof DirectoryStatus)[keyof typeof DirectoryStatus];

/** A locked room's name gets a code, so a plain room of the same name never meets its handshake. */
export function locked_name(room: string): string {
  const code = Math.random().toString(36).slice(2, 2 + LOCK_CODE).padEnd(LOCK_CODE, "0");
  return `${[...room].slice(0, ROOM_LENGTH - LOCK_CODE - 1).join("").trim()}~${code}`;
}

export function clean_password(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || /\p{C}/u.test(raw) || [...raw].length > PASSWORD_LENGTH) return null;
  return raw;
}

// Any game in the directory is a stranger; capped so a hostile peer can't stuff the list or the join link.
export function sanitize_announce(raw: unknown): Announce | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const room = clean_room(a.room);
  if (room === null || room !== a.room) return null;
  if (typeof a.seed !== "number" || !Number.isInteger(a.seed) || a.seed < 0 || a.seed > MAX_SEED) return null;
  if (typeof a.players !== "number" || !Number.isInteger(a.players) || a.players < 1) return null;
  if (typeof a.locked !== "boolean" || typeof a.version !== "string" || !VERSION.test(a.version)) return null;
  if (!a.locked && LOCKED_NAME.test(room)) return null;
  if (a.world !== undefined && (typeof a.world !== "number" || !Number.isInteger(a.world) || a.world < 1 || a.world > MAX_SEED)) return null;
  const announce: Announce = { room, seed: a.seed, host: clean_name(a.host), players: Math.min(a.players, MAX_PLAYERS), locked: a.locked, version: a.version };
  if (a.world !== undefined) announce.world = a.world;
  const map = clean_map_code(a.map);
  if (map !== null) announce.map = map;
  if (a.racing === true) announce.racing = true;
  if (Array.isArray(a.roster)) {
    const roster = a.roster.slice(0, MAX_ROSTER).map(sanitize_entry).filter((entry) => entry !== null);
    if (roster.length) announce.roster = roster;
  }
  return announce;
}

function sanitize_entry(raw: unknown): RosterEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.name !== "string") return null;
  const entry: RosterEntry = { name: clean_name(e.name) };
  const country = clean_country(e.country);
  if (country !== null) entry.country = country;
  if (e.racing === true) entry.racing = true;
  return entry;
}

const key_of = (a: Announce) => JSON.stringify([a.room, a.seed, a.world ?? world_id(WorldKind.ISLAND), a.locked, a.version, ...(a.map ? [a.map] : [])]);

// One game has one elected announcer; if two claim the same game (a hand-over, or a spoof), the lowest peer id wins
// whole, so host and player count always come from a single announce and every viewer shows the same row.
export function group_servers(entries: Iterable<readonly [string, Announce]>, own: Announce | null): Server[] {
  const best = new Map<string, readonly [string, Announce]>();
  for (const entry of entries) {
    const key = key_of(entry[1]);
    const known = best.get(key);
    if (!known || entry[0] < known[0]) best.set(key, entry);
  }
  const own_key = own ? key_of(own) : null;
  if (own && own_key && !best.has(own_key)) best.set(own_key, ["", own]);
  return [...best]
    .map(([key, [peer, a]]) => ({ ...a, key, here: key === own_key, peer }))
    .sort((a, b) => Number(b.here) - Number(a.here) || b.players - a.players || a.room.localeCompare(b.room) || a.seed - b.seed);
}

// A saved password only ever applies to the room it was entered for; landing anywhere else forgets it.
export function load_lock(room: string): RoomLock | null {
  try {
    const text = sessionStorage.getItem(LOCK_KEY);
    if (text === null) return null;
    const saved: unknown = JSON.parse(text);
    if (saved && typeof saved === "object" && "room" in saved && saved.room === room && "password" in saved) {
      const password = clean_password(saved.password);
      if (password !== null) return { password, asked: "asked" in saved && saved.asked === true };
    }
    sessionStorage.removeItem(LOCK_KEY);
  } catch (error) {
    console.warn("directory: saved room password unreadable", error);
  }
  return null;
}

export function save_lock(room: string, lock: RoomLock | null) {
  try {
    if (lock === null) sessionStorage.removeItem(LOCK_KEY);
    else sessionStorage.setItem(LOCK_KEY, JSON.stringify({ room, ...lock }));
  } catch (error) {
    console.warn("directory: room password not kept", error);
  }
}

// A role, sent after joining: true while the peer only watches for player counts. Peers that predate it never say and
// count as browsers.
type Role = { watch: boolean };

const sanitize_role = (raw: unknown): Role | null => (raw && typeof raw === "object" && typeof (raw as Record<string, unknown>).watch === "boolean" ? { watch: (raw as Role).watch } : null);

// Joined and mid-handshake peers both count, so a burst of handshakes can't all pass before any of them joins; a peer
// turned away stays turned away for the session, so its reconnect attempts end at once instead of churning. A full
// directory makes room for a newcomer by dropping a watcher, since the newcomer may be a player browsing the list; a
// watcher past the watcher cap is dropped as soon as it says what it is.
export class Admission {
  readonly joined = new Set<string>();
  private readonly pending = new Set<string>();
  private readonly refused = new Set<string>();
  private readonly watchers = new Set<string>();

  constructor(
    private readonly cap: number,
    private readonly watch_cap = cap,
    private readonly evict: (id: string) => void = () => {},
  ) {}

  admit(id: string): boolean {
    if (this.refused.has(id)) return false;
    if (this.joined.has(id) || this.pending.has(id)) return true;
    if (this.joined.size + this.pending.size >= this.cap) {
      const watcher = this.watchers.values().next();
      if (watcher.done) {
        this.refused.add(id);
        return false;
      }
      this.kick(watcher.value);
    }
    this.pending.add(id);
    return true;
  }

  role(id: string, watch: boolean) {
    if (!this.joined.has(id)) return;
    if (!watch) this.watchers.delete(id);
    else if (!this.watchers.has(id)) {
      this.watchers.add(id);
      if (this.watchers.size > this.watch_cap) this.kick(id);
    }
  }

  private kick(id: string) {
    this.drop(id);
    this.refused.add(id);
    this.evict(id);
  }

  join(id: string) {
    this.pending.delete(id);
    this.joined.add(id);
  }

  drop(id: string) {
    this.pending.delete(id);
    this.joined.delete(id);
    this.watchers.delete(id);
  }

  reset() {
    this.pending.clear();
    this.joined.clear();
    this.refused.clear();
    this.watchers.clear();
  }
}

const dropped = (error: unknown) => console.debug("directory: announce dropped", error);

export class Directory {
  status: DirectoryStatus = DirectoryStatus.CONNECTING;
  private readonly entries = new Map<string, Entry>();
  private readonly limits = new Map<string, RateLimit>();
  private readonly admission = new Admission(MAX_PEERS, MAX_WATCHERS, (peer) => this.kick(peer));
  private readonly pings = new Map<string, number>();
  private room: Room | null = null;
  private send: ((announce: Announce, target?: string) => void) | null = null;
  private send_role: ((target?: string) => void) | null = null;
  private mode: Mode = "off";
  private browsing = false;
  private watching = false;
  private timer = 0;
  private empty_timer = 0;
  private ping_timer = 0;

  constructor(
    private readonly own: () => Announce,
    private readonly leader: () => boolean,
  ) {}

  start() {
    this.timer = window.setInterval(() => this.tick(), ANNOUNCE_MS);
    this.tick();
  }

  stop() {
    clearInterval(this.timer);
    this.switch_to("off");
  }

  /** A player looking at the list connects to announcers and pings them. */
  browse(on: boolean) {
    if (on === this.browsing) return;
    this.browsing = on;
    this.tick();
    this.sync_pings();
    this.send_role?.();
  }

  /**
   * Connects to announcers for the HUD's player counts, without pings. Watchers link to each other too, so only each
   * game's leader watches and passes the count to its room.
   */
  watch(on: boolean) {
    if (on === this.watching) return;
    this.watching = on;
    this.tick();
  }

  /** Players in every other listed game; null while the directory is still connecting. */
  elsewhere(): number | null {
    if (this.status === DirectoryStatus.CONNECTING) return null;
    let count = 0;
    for (const server of this.list()) if (!server.here) count += server.players;
    return count;
  }

  list(): Server[] {
    return group_servers(this.heard(), sanitize_announce(this.own()));
  }

  /** Every listed game's players, this game first, each with the ping to its game's announcer. */
  players(): Player[] {
    return player_list(this.list(), this.pings, sanitize_announce(this.own()));
  }

  private heard(): (readonly [string, Announce])[] {
    const now = performance.now();
    for (const [id, entry] of this.entries) if (now - entry.seen > EXPIRE_MS) this.entries.delete(id);
    return [...this.entries].map(([id, entry]) => [id, entry.announce] as const);
  }

  private announcement(): Announce | null {
    return this.leader() ? sanitize_announce(this.own()) : null;
  }

  private ping(room: Room, peer: string) {
    room
      .ping(peer)
      .then((ms) => {
        if (this.room === room && this.admission.joined.has(peer)) this.pings.set(peer, Math.round(ms));
      })
      .catch((error: unknown) => console.debug("directory: ping failed", error));
  }

  private tick() {
    const own = this.announcement();
    const mode: Mode = this.browsing || this.watching ? "listen" : own ? "announce" : "off";
    if (mode !== this.mode) this.switch_to(mode);
    if (own) this.send?.(own);
    // Repeated with the announce: a role that beat the peer's join on the other side was dropped there.
    this.send_role?.();
  }

  private switch_to(mode: Mode) {
    this.leave();
    this.mode = mode;
    if (mode === "off") return;
    this.status = DirectoryStatus.CONNECTING;
    try {
      // Announcers join passive: trystero never pairs two passive peers, so a game only links to players browsing the list.
      const room = joinRoom({ appId: APP_ID, turnConfig: TURN_SERVERS, maxReceiveBytes: MAX_RECEIVE_BYTES, passive: mode === "announce" }, DIRECTORY_ROOM, {
        onPeerHandshake: async (peer) => {
          if (!this.admission.admit(peer)) throw new Error("directory: peer cap reached");
        },
        onJoinError: ({ peerId }) => {
          if (!this.admission.joined.has(peerId)) this.admission.drop(peerId);
        },
      });
      const action = room.makeAction<Announce>("announce");
      this.send = (announce, target) => void action.send(announce, target ? { target } : undefined).catch(dropped);
      action.onMessage = (raw, { peerId }) => this.receive(raw, peerId);
      const role = room.makeAction<Role>("role");
      this.send_role = (target) => {
        if (this.mode === "listen") void role.send({ watch: !this.browsing }, target ? { target } : undefined).catch(dropped);
      };
      role.onMessage = (raw, { peerId }) => {
        const msg = sanitize_role(raw);
        if (msg) this.admission.role(peerId, msg.watch);
      };
      room.onPeerJoin = (peer) => {
        this.admission.join(peer);
        this.status = DirectoryStatus.ONLINE;
        if (this.browsing) this.ping(room, peer);
        if (this.mode === "listen") this.send_role?.(peer);
        const own = this.announcement();
        if (own) this.send?.(own, peer);
      };
      room.onPeerLeave = (peer) => {
        this.admission.drop(peer);
        this.entries.delete(peer);
        this.limits.delete(peer);
        this.pings.delete(peer);
      };
      this.room = room;
      this.sync_pings();
      if (mode === "listen") {
        this.empty_timer = window.setTimeout(() => {
          if (this.status === DirectoryStatus.CONNECTING) this.status = DirectoryStatus.OFFLINE;
        }, EMPTY_AFTER_MS);
      }
    } catch (error) {
      console.warn("directory unavailable, the server list shows this game only", error);
      this.status = DirectoryStatus.OFFLINE;
    }
  }

  private sync_pings() {
    const room = this.room;
    const on = this.browsing && room !== null;
    if (on === (this.ping_timer !== 0)) return;
    clearInterval(this.ping_timer);
    this.ping_timer = 0;
    this.pings.clear();
    if (!on) return;
    for (const peer of this.admission.joined) this.ping(room, peer);
    this.ping_timer = window.setInterval(() => {
      for (const peer of this.admission.joined) this.ping(room, peer);
    }, PING_MS);
  }

  private kick(peer: string) {
    this.entries.delete(peer);
    this.limits.delete(peer);
    this.pings.delete(peer);
    this.room?.getPeers()[peer]?.close();
  }

  private leave() {
    clearTimeout(this.empty_timer);
    clearInterval(this.ping_timer);
    this.ping_timer = 0;
    this.room?.leave().catch((error: unknown) => console.debug("directory: leave failed", error));
    this.room = null;
    this.send = null;
    this.send_role = null;
    this.entries.clear();
    this.limits.clear();
    this.pings.clear();
    this.admission.reset();
  }

  private receive(raw: unknown, peer: string) {
    if (!this.admission.joined.has(peer)) return;
    let limit = this.limits.get(peer);
    if (!limit) this.limits.set(peer, (limit = new RateLimit(ANNOUNCE_GAP_MS, ANNOUNCE_BURST)));
    if (!limit.allow(performance.now())) return;
    const announce = sanitize_announce(raw);
    if (announce) this.entries.set(peer, { announce, seen: performance.now() });
  }
}
