import { joinRoom, selfId, type Room } from "trystero";
import { decode_car, encode_car } from "./car-packet";
import { Link, type Channel } from "./channel";
import { RateLimit } from "./rate-limit";
import { BlockedWatch } from "./blocked";
import { clean_country } from "./country";
import { TURN_SERVERS } from "./ice";
import { READY_BURST, READY_GAP_MS, type ReadyMsg } from "./ready";
import { WORLD_VERSION } from "../worldgen/types";
import { MAX_SEED } from "./seed";
import { clean_map_code } from "../worldgen/kinds/map-code";

export { RateLimit };

// A type alias, not an interface: trystero's DataPayload needs the implicit index signature only aliases get.
export type CarState = {
  id: string;
  name: string;
  paint: number;
  /** Build code (`build_code`), e.g. `"coupe.3.1.2.1.0"`; absent from peers that sent none or a bad one. */
  b?: string;
  seed: number;
  /** `WORLD_VERSION` of the sender's build; peers that predate it send none and are on world 1. */
  w?: number;
  t: number;
  p: [number, number, number];
  q: [number, number, number, number];
  v: [number, number, number];
  steer: number;
  brake: boolean;
  /** Nitro firing; absent from peers that predate it. */
  boost?: boolean;
  best: number | null;
};

/** A car packet this build can't read is still a sign of life: a peer on another protocol, or garbage. */
export type CarPacket = { kind: "car"; state: CarState } | { kind: "unreadable" };

export type ChatMsg = { text: string; t: number };

/**
 * Sent to each peer as it joins, again when the sender's country setting changes. `world` is the sender's `map_id`,
 * `seed` its map seed, `country` its ISO code when shared; peers that predate it send none. `map` is the code of a
 * custom map, absent on a plain one. `tier` is the sender's career badge (`rewards.ts`), absent until a final is finished.
 */
export type Hello = { protocol: number; version: string; world: number; seed: number; country?: string; map?: string; tier?: Tier };

export type Tier = 1 | 2 | 3;

export const clean_tier = (raw: unknown): Tier | null => (raw === 1 || raw === 2 || raw === 3 ? raw : null);

export function make_hello(version: string, world: number, seed: number, map: string | null, country: string | null, tier: Tier | null = null): Hello {
  const hello: Hello = { protocol: PROTOCOL, version, world, seed };
  if (country !== null) hello.country = country;
  if (map !== null) hello.map = map;
  if (tier !== null) hello.tier = tier;
  return hello;
}

/**
 * Same seed and `w`, and when both sides named a custom map, the same code: the 15-bit hash in `w` can collide, the
 * code can't. A build from before map codes compares seed and `w` alone, which a custom map's `w` never matches.
 */
export function same_map(own: { seed: number; world: number; map: string | null }, peer: { seed: number; w?: number; map?: string }): boolean {
  if (peer.seed !== own.seed || peer.w !== own.world) return false;
  return own.map === null || peer.map === undefined || peer.map === own.map;
}

/** One player of a game, as its leader lists it in the directory. */
export type RosterEntry = { name: string; country?: string; tier?: Tier; racing?: boolean };

/**
 * `start_at` is in the sender's `performance.now()` clock; receivers shift it by their `Sender.offset`. `route` is a
 * `Route.id`; peers that predate it send none and mean the circuit.
 */
export type RaceEvent =
  | { kind: "request"; laps: number; route: string }
  | { kind: "start"; race: number; laps: number; start_at: number; route: string }
  | { kind: "finish"; race: number; time: number };

interface Snapshot {
  at: number;
  state: CarState;
}

interface Foreign {
  name: string;
  seed: number;
  world: number;
  seen: number;
}

interface Sighting {
  name: string;
  /** Same as `Remote.offset`, kept for peers past the car cap too. */
  offset: number;
  seen: number;
}

/** Who sent a race event: a peer on this map, with a display name and its clock offset (see `Remote.offset`). */
export interface Sender {
  id: string;
  name: string;
  offset: number;
}

export interface RoomLock {
  password: string;
  /** Typed into the unlock form to get in, so a handshake failure is this player's wrong guess, not an intruder's. */
  asked: boolean;
}

export interface Remote {
  id: string;
  latest: CarState;
  snapshots: Snapshot[];
  offset: number;
  seen: number;
}

const DELAY = 110;
const OFFSET_DRIFT = 0.5;
// Long enough for the room's players to show up, so a newcomer doesn't briefly announce a game it isn't hosting.
const ELECT_MS = 5000;
export const WRONG_PASSWORD = "wrong password";
export const TURNED_AWAY = "searching · turned away a wrong password";
// A bad SDP decrypt, or a bad challenge over a connection two peers already share from another room. Never a timeout:
// that is as likely a slow network as a bad password.
const PASSWORD_ERROR = /incorrect (room )?password/;
// Trystero's wording when offers crossed through the relay but no direct route opened: without a TURN server that is a
// network refusing peer-to-peer, usually a carrier NAT.
const SDP_FAILED = /could not connect to peer .* after exchanging SDP/;
export const NETWORK_BLOCKED = "network blocked";
const TIMEOUT = 4000;
const MAX_REMOTES = 16;
const MIN_GAP_MS = 25;
const NAME_LENGTH = 24;
const CHAT_LENGTH = 140;
// Stricter than what peers accept, so network jitter bunching two sends together never gets a legit message dropped.
const OWN_CHAT_GAP_MS = 900;
const OWN_CHAT_BURST = 4;
const FALLBACK_NAME = "Player";
const MAX_ONLINE = 9999;
// The leader repeats its count every few seconds; one this old means it stopped or its tab is hidden.
const ONLINE_STALE_MS = 10_000;
// A leader sends once per SEND_MS in hud/presence.ts; this lets a little jitter through and stops a flood.
const ONLINE_GAP_MS = 1000;
const ONLINE_BURST = 6;
const ID_SUFFIX = 4;

export const APP_ID = "lilbunnyrabbit-harepin";
export const MAX_LAPS = 10;
/**
 * Wire protocol of this build. Bump it when peers on different protocols can no longer play together. A peer that never
 * says hello predates it: `LEGACY_PROTOCOL`, on `LEGACY_VERSION` or older.
 */
export const PROTOCOL = 2;
export const LEGACY_PROTOCOL = 0;
export const LEGACY_VERSION = "0.10.0";
const MAX_PROTOCOL = 1e6;
const SEMVER = /^\d{1,6}\.\d{1,6}\.\d{1,6}$/;
const MAX_RACE_MS = 1e7;

const finite = (v: unknown, limit: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit;

const UNREADABLE: CarPacket = { kind: "unreadable" };

export function read_car(raw: unknown, id: string): CarPacket | null {
  if (raw === null || raw === undefined) return null;
  const state = decode_car(raw, id);
  if (!state) return UNREADABLE;
  state.name = clean_name(state.name);
  return { kind: "car", state };
}

// Both sides of a refused handshake get the same error, so only a player who typed a guess and never got in reads it
// as their own failure; a host who has never had company reads it as someone else's.
export function join_error_status(lock: RoomLock | null, had_peer: boolean, peers: number, error: string): string | null {
  if (!lock || had_peer || !PASSWORD_ERROR.test(error)) return null;
  if (lock.asked) return WRONG_PASSWORD;
  return peers === 0 ? TURNED_AWAY : null;
}

export function is_sdp_failure(error: string): boolean {
  return SDP_FAILED.test(error);
}

export function leader_of(self: string, ids: Iterable<string>): string {
  let leader = self;
  for (const id of ids) if (id < leader) leader = id;
  return leader;
}

const laps_ok = (v: unknown): v is number => finite(v, MAX_LAPS) && Number.isInteger(v) && v >= 1;
const race_ok = (v: unknown): v is number => finite(v, MAX_SEED) && Number.isInteger(v) && v >= 0;
const route_of = (v: unknown): string | null => (v === undefined ? "circuit" : typeof v === "string" && /^[a-z][a-z0-9-]{0,23}$/.test(v) ? v : null);

export function sanitize_event(raw: unknown): RaceEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const route = route_of(e.route);
  if (e.kind === "request" && laps_ok(e.laps) && route) return { kind: "request", laps: e.laps, route };
  if (e.kind === "start" && race_ok(e.race) && laps_ok(e.laps) && finite(e.start_at, 1e12) && route) return { kind: "start", race: e.race, laps: e.laps, start_at: e.start_at, route };
  if (e.kind === "finish" && race_ok(e.race) && finite(e.time, MAX_RACE_MS) && e.time > 0) return { kind: "finish", race: e.race, time: e.time };
  return null;
}

/** Players online across every game, as this map's leader hears the directory. */
export type OnlineMsg = { online: number };

export function sanitize_online(raw: unknown): OnlineMsg | null {
  if (!raw || typeof raw !== "object") return null;
  const online = (raw as Record<string, unknown>).online;
  return typeof online === "number" && Number.isInteger(online) && online >= 1 ? { online: Math.min(online, MAX_ONLINE) } : null;
}

export function sanitize_ready(raw: unknown): ReadyMsg | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.ready === false) return { ready: false };
  const route = route_of(m.route);
  return m.ready === true && laps_ok(m.laps) && route ? { ready: true, laps: m.laps, route } : null;
}

const uint = (v: unknown, limit: number): v is number => finite(v, limit) && Number.isInteger(v) && v >= 0;

export function sanitize_hello(raw: unknown): Hello | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  if (!uint(h.protocol, MAX_PROTOCOL) || typeof h.version !== "string" || !SEMVER.test(h.version)) return null;
  if (!uint(h.world, MAX_SEED) || h.world === 0 || !uint(h.seed, MAX_SEED)) return null;
  const hello: Hello = { protocol: h.protocol, version: h.version, world: h.world, seed: h.seed };
  const country = clean_country(h.country);
  if (country !== null) hello.country = country;
  const map = clean_map_code(h.map);
  if (map !== null) hello.map = map;
  const tier = clean_tier(h.tier);
  if (tier !== null) hello.tier = tier;
  return hello;
}

export function sanitize_chat(raw: unknown): ChatMsg | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.text !== "string" || !finite(m.t, 1e12)) return null;
  const text = [...m.text.replace(/\p{C}/gu, "").trim()].slice(0, CHAT_LENGTH).join("").trim();
  return text ? { text, t: m.t } : null;
}

export function clean_name(raw: unknown): string {
  if (typeof raw !== "string") return FALLBACK_NAME;
  let name = raw.replace(/\p{C}/gu, "").replace(/\s+/gu, " ").trim();
  while (/\(you\)$/iu.test(name)) name = name.replace(/\(you\)$/iu, "").trim();
  name = [...name].slice(0, NAME_LENGTH).join("").trim();
  return name || FALLBACK_NAME;
}

export class Net {
  readonly id = selfId;
  readonly remotes = new Map<string, Remote>();
  /** Peers in this room on another seed, by id: their seed and when they were last heard (performance.now ms). */
  readonly foreign = new Map<string, Foreign>();
  /** Peers on this map, by id. Uncapped, unlike `remotes`, so every player elects the same leader and hears its race events. */
  readonly same_map = new Map<string, Sighting>();
  /** What each peer said about its build as it joined; see `protocol_of`. */
  readonly hellos = new Map<string, Hello>();
  /** Peers whose car packets this build can't read, by id: when they were last heard (performance.now ms). */
  private readonly unreadable = new Map<string, number>();
  private older = 0;
  private newer = 0;
  status = "connecting";
  private readonly link: Link;
  private readonly cars: Channel<CarPacket, Uint8Array>;
  private readonly chats: Channel<ChatMsg>;
  private readonly events: Channel<RaceEvent>;
  private readonly hello: Channel<Hello>;
  private readonly readies: Channel<ReadyMsg>;
  private readonly onlines: Channel<OnlineMsg>;
  private heard_online: { from: string; count: number; at: number } | null = null;
  private own_chat_limit = new RateLimit(OWN_CHAT_GAP_MS, OWN_CHAT_BURST);

  private name_: string;

  private readonly joined = performance.now();
  private readonly peer_ids = new Set<string>();
  /** Senders greeted over the BroadcastChannel, so a legacy tab that never answers gets exactly one hello. */
  private readonly greeted = new Set<string>();
  private had_peer = false;
  private readonly blocked = new BlockedWatch();
  private country: string | null = null;
  private tier: Tier | null = null;

  /** `lock` locks the room: peers without the same password fail the trystero handshake and never connect. */
  constructor(
    readonly room: string,
    readonly seed: number,
    name: string,
    private readonly lock: RoomLock | null = null,
    /** Map identity stamped as `w`: `world_id` of the world kind. */
    readonly world = WORLD_VERSION,
    /** `package.json` version, sent in the hello. */
    readonly version = "0.0.0",
    join = joinRoom,
    /** This map's code when it is a custom one, sent in the hello. */
    readonly map: string | null = null,
  ) {
    this.name_ = clean_name(name);
    const password = lock?.password ?? null;
    let p2p: Room | null = null;
    try {
      p2p = join({ appId: APP_ID, turnConfig: TURN_SERVERS, ...(password === null ? {} : { password }) }, room, {
        onJoinError: ({ error }) => {
          if (is_sdp_failure(error)) {
            this.blocked.fail(performance.now());
            this.check_blocked();
          } else this.status = join_error_status(lock, this.had_peer, this.peers, error) ?? this.status;
        },
      });
      this.status = "searching";
    } catch (error) {
      console.warn("p2p unavailable, same-browser tabs only", error);
      this.status = "local only";
    }
    // Same-browser tabs skip WebRTC, so a locked room keys its channel by the password too.
    const local = new BroadcastChannel(password === null ? `harepin:${room}` : `harepin-locked:${JSON.stringify([room, password])}`);
    this.link = new Link(this.id, local, p2p);
    this.cars = this.link.channel<CarPacket, Uint8Array>("car", read_car);
    this.chats = this.link.channel("chat", sanitize_chat, () => new RateLimit());
    this.events = this.link.channel("event", sanitize_event, () => new RateLimit(), (id) => this.same_map.has(id) || this.remotes.has(id));
    this.hello = this.link.channel("hello", sanitize_hello);
    this.readies = this.link.channel("ready", sanitize_ready, () => new RateLimit(READY_GAP_MS, READY_BURST), (id) => this.same_map.has(id) || this.remotes.has(id));
    this.onlines = this.link.channel("online", sanitize_online, () => new RateLimit(ONLINE_GAP_MS, ONLINE_BURST), (id) => this.same_map.has(id) || this.remotes.has(id));
    this.onlines.subscribe((msg, from) => {
      if (from === this.leader_id) this.heard_online = { from, count: msg.online, at: performance.now() };
    });
    this.cars.subscribe((packet, sender) => {
      this.greet(sender);
      if (packet.kind === "car") {
        if (this.unreadable.delete(sender)) this.recount();
        this.receive(packet.state);
      } else if (this.protocol_of(sender) !== PROTOCOL) {
        const known = this.unreadable.has(sender);
        this.unreadable.set(sender, performance.now());
        if (!known) this.recount();
      }
    });
    this.hello.subscribe((hello, sender) => {
      this.greet(sender);
      this.hellos.set(sender, hello);
      if (hello.protocol === PROTOCOL) this.unreadable.delete(sender);
      this.recount();
    });
    // Same-browser tabs never fire onPeerJoin: open tabs hear this hello, and greet back a tab they hear from first.
    this.hello.send_local(this.own_hello);
    if (!p2p) return;
    p2p.onPeerJoin = (peer) => {
      this.peer_ids.add(peer);
      this.had_peer = true;
      this.blocked.clear();
      this.hello.send(this.own_hello, peer);
      this.status = "online";
    };
    p2p.onPeerLeave = (peer) => {
      this.peer_ids.delete(peer);
      if (this.peers === 0) this.status = "searching";
      this.remotes.delete(peer);
      this.same_map.delete(peer);
      this.link.forget(peer);
      this.hellos.delete(peer);
      this.unreadable.delete(peer);
      this.recount();
      this.greeted.delete(peer);
    };
  }

  private get own_hello(): Hello {
    return make_hello(this.version, this.world, this.seed, this.map, this.country, this.tier);
  }

  /** Null hides it; peers already here hear the change. */
  set_country(country: string | null) {
    if (country === this.country) return;
    this.country = country;
    this.hello.send(this.own_hello);
  }

  /** The career badge this player shows online; peers already here hear the change. */
  set_tier(tier: Tier | null) {
    if (tier === this.tier) return;
    this.tier = tier;
    this.hello.send(this.own_hello);
  }

  private check_blocked() {
    const blocked = this.peers === 0 && this.blocked.blocked(performance.now());
    if (blocked) this.status = NETWORK_BLOCKED;
    else if (this.status === NETWORK_BLOCKED) this.status = this.peers ? "online" : "searching";
  }

  /** This map's players for the directory, this player first: names as they sent them, countries and tiers from their hellos. */
  roster(racing: boolean): RosterEntry[] {
    const entry = (name: string, country: string | null | undefined, tier: Tier | null | undefined): RosterEntry => ({ name, ...(country ? { country } : {}), ...(tier ? { tier } : {}), ...(racing ? { racing } : {}) });
    return [entry(this.name, this.country, this.tier), ...[...this.same_map].map(([id, sighting]) => entry(sighting.name, this.hellos.get(id)?.country, this.hellos.get(id)?.tier))];
  }

  private greet(peer: string) {
    if (this.greeted.has(peer)) return;
    this.greeted.add(peer);
    this.hello.send_local(this.own_hello, peer);
  }

  /** Peers that never said hello run `LEGACY_PROTOCOL`; one whose hello is still in flight reads as legacy too. */
  protocol_of(id: string): number {
    return this.hellos.get(id)?.protocol ?? LEGACY_PROTOCOL;
  }

  /** Peers heard on an older protocol (or none), whose cars this build can't show. */
  get older_peers(): number {
    return this.older;
  }

  /** Peers heard on a newer protocol: this build is out of date for them. */
  get newer_peers(): number {
    return this.newer;
  }

  private recount() {
    this.older = 0;
    for (const id of this.unreadable.keys()) if (this.protocol_of(id) < PROTOCOL) this.older++;
    this.newer = this.unreadable.size - this.older;
  }

  get peers(): number {
    return this.peer_ids.size;
  }

  get name(): string {
    return this.name_;
  }

  set_name(name: string) {
    this.name_ = clean_name(name);
  }

  send(state: CarState) {
    this.cars.send(encode_car({ ...state, w: this.world }));
  }

  send_chat(text: string): string | null {
    const msg = sanitize_chat({ text, t: performance.now() });
    if (!msg || !this.own_chat_limit.allow(msg.t)) return null;
    this.chats.send(msg);
    return msg.text;
  }

  // Any room peer may chat: one on another map, or one whose first car packet hasn't landed, has no `Remote` yet.
  on_chat(fn: (name: string, text: string) => void): () => void {
    return this.chats.subscribe((msg, sender) => {
      const remote = this.remotes.get(sender);
      fn(remote ? this.display_name(remote) : this.label(sender, this.foreign.get(sender)?.name ?? FALLBACK_NAME), msg.text);
    });
  }

  /** A peer's name, with a short id suffix when someone else in the room (you included) uses the same one. */
  display_name(remote: Remote): string {
    return this.label(remote.id, remote.latest.name);
  }

  private label(id: string, name: string): string {
    const taken = name === this.name || [...this.remotes.values()].some((r) => r.id !== id && r.latest.name === name);
    return taken ? `${name} #${id.slice(0, ID_SUFFIX)}` : name;
  }

  send_event(event: RaceEvent) {
    this.events.send(event);
  }

  on_event(fn: (event: RaceEvent, from: Sender) => void): () => void {
    return this.events.subscribe((event, id) => {
      const from = this.sender(id);
      if (from) fn(event, from);
    });
  }

  send_ready(msg: ReadyMsg) {
    this.readies.send(msg);
  }

  send_online(count: number) {
    this.onlines.send({ online: count });
  }

  /** The online count this map's leader last sent; null when the leader hasn't sent one lately. */
  get leader_online(): number | null {
    const heard = this.heard_online;
    return heard && heard.from === this.leader_id && performance.now() - heard.at < ONLINE_STALE_MS ? heard.count : null;
  }

  on_ready(fn: (msg: ReadyMsg, from: Sender) => void): () => void {
    return this.readies.subscribe((msg, id) => {
      const from = this.sender(id);
      if (from) fn(msg, from);
    });
  }

  /** A same-map peer's display name, as race events and readies carry it. */
  name_of(id: string): string {
    return this.sender(id)?.name ?? FALLBACK_NAME;
  }

  private sender(id: string): Sender | null {
    const remote = this.remotes.get(id);
    if (remote) return { id, name: this.display_name(remote), offset: remote.offset };
    const sighting = this.same_map.get(id);
    return sighting ? { id, name: this.label(id, sighting.name), offset: sighting.offset } : null;
  }

  private receive(state: CarState) {
    const now = performance.now();
    // The same seed on another world version is another island: racing on it would mean racing on different roads.
    if (!same_map(this, { seed: state.seed, w: state.w, map: this.hellos.get(state.id)?.map })) {
      this.foreign.set(state.id, { name: state.name, seed: state.seed, world: state.w ?? 1, seen: now });
      this.remotes.delete(state.id);
      this.same_map.delete(state.id);
      return;
    }
    this.foreign.delete(state.id);
    const offset = now - state.t;
    const sighting = this.same_map.get(state.id);
    this.same_map.set(state.id, { name: state.name, offset: sighting ? Math.min(sighting.offset + OFFSET_DRIFT, offset) : offset, seen: now });
    let remote = this.remotes.get(state.id);
    if (remote && state.t - remote.latest.t < MIN_GAP_MS && remote.snapshots.length) return;
    if (!remote) {
      if (this.remotes.size >= MAX_REMOTES) return;
      remote = { id: state.id, latest: state, snapshots: [], offset: now - state.t, seen: now };
      this.remotes.set(state.id, remote);
    }
    if (state.t <= remote.latest.t && remote.snapshots.length) return;
    // Clock offset tracks the fastest delivery seen, drifting up slowly so a one-off lucky packet doesn't pin it.
    remote.offset = Math.min(remote.offset + OFFSET_DRIFT, now - state.t);
    remote.latest = state;
    remote.seen = now;
    remote.snapshots.push({ at: state.t, state });
    if (remote.snapshots.length > 40) remote.snapshots.shift();
  }

  prune() {
    const now = performance.now();
    for (const [id, remote] of this.remotes) if (now - remote.seen > TIMEOUT) this.remotes.delete(id);
    for (const [id, { seen }] of this.foreign) if (now - seen > TIMEOUT) this.foreign.delete(id);
    for (const [id, { seen }] of this.same_map) if (now - seen > TIMEOUT) this.same_map.delete(id);
    for (const [id, seen] of this.unreadable) if (now - seen > TIMEOUT) this.unreadable.delete(id);
    this.recount();
    this.check_blocked();
  }

  /**
   * The lowest id among this map's players speaks for the game in the directory. A player who typed a password and
   * never got in can't: their guess may be wrong, and they would list a lone copy of someone else's locked game.
   */
  get leader(): boolean {
    if (this.lock?.asked && !this.had_peer) return false;
    return !this.electing && this.leader_id === this.id;
  }

  /** Within `ELECT_MS` of joining, while players already here may not have been heard. */
  get electing(): boolean {
    return performance.now() - this.joined <= ELECT_MS;
  }

  get leader_id(): string {
    return leader_of(this.id, this.same_map.keys());
  }

  /** Just joined, with room peers whose map no car packet has told yet: one of them may be the leader. */
  get settling(): boolean {
    if (!this.electing) return false;
    for (const id of this.peer_ids) if (!this.same_map.has(id) && !this.foreign.has(id)) return true;
    return false;
  }

  render_time(remote: Remote): number {
    return performance.now() - remote.offset - DELAY;
  }
}
