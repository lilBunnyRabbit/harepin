import { joinRoom, selfId } from "trystero";
import { build_code, parse_build } from "./build";
import { WORLD_VERSION, WorldKind, world_id } from "./worldgen/types";

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

export type ChatMsg = { text: string; t: number };

/**
 * `start_at` is in the sender's `performance.now()` clock; receivers shift it by their `Remote.offset`. `route` is a
 * `Route.id`; peers that predate it send none and mean the circuit.
 */
export type RaceEvent =
  | { kind: "request"; laps: number; route: string }
  | { kind: "start"; race: number; laps: number; start_at: number; route: string }
  | { kind: "finish"; race: number; time: number };

type Packet =
  | { kind: "car"; id: string; data: CarState }
  | { kind: "chat"; id: string; data: ChatMsg }
  | { kind: "event"; id: string; data: RaceEvent };

interface Snapshot {
  at: number;
  state: CarState;
}

interface Foreign {
  seed: number;
  world: number;
  seen: number;
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
// Long enough for the room's players to show up, so a newcomer doesn't briefly announce a game it isn't hosting.
const ELECT_MS = 5000;
export const WRONG_PASSWORD = "wrong password";
const TURNED_AWAY = "searching · turned away a wrong password";
// A bad SDP decrypt, or a bad challenge over a connection two peers already share from another room. Never a timeout:
// that is as likely a slow network as a bad password.
const PASSWORD_ERROR = /incorrect (room )?password/;
const TIMEOUT = 4000;
const MAX_REMOTES = 16;
const MIN_GAP_MS = 25;
const WORLD_LIMIT = 5000;
const NAME_LENGTH = 24;
const CHAT_LENGTH = 140;
const CHAT_GAP_MS = 800;
const CHAT_BURST = 5;
const CHAT_WINDOW_MS = 10_000;
// Stricter than what peers accept, so network jitter bunching two sends together never gets a legit message dropped.
const OWN_CHAT_GAP_MS = 900;
const OWN_CHAT_BURST = 4;
const FALLBACK_NAME = "Player";
const ID_SUFFIX = 4;

export const APP_ID = "lilbunnyrabbit-harepin";
export const MAX_SEED = 0xffffffff;
export const MAX_LAPS = 10;
const MAX_RACE_MS = 1e7;

const finite = (v: unknown, limit: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit;
const dropped = (error: unknown) => console.debug("net: send dropped", error);
const triple = (v: unknown, limit: number): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((x) => finite(x, limit));

// Peers are untrusted: anything that reaches the scene (positions, quaternions, names) is shape-checked and clamped
// here, so one bad or hostile client can't put NaN into another player's renderer or flood it with cars.
export function sanitize(raw: unknown, id: string): CarState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (!finite(s.t, 1e12) || !triple(s.p, WORLD_LIMIT) || !triple(s.v, 500)) return null;
  if (!finite(s.seed, MAX_SEED) || !Number.isInteger(s.seed) || s.seed < 0) return null;
  const q = s.q;
  if (!Array.isArray(q) || q.length !== 4 || !q.every((x) => finite(x, 1.01))) return null;
  const length = Math.hypot(...(q as number[]));
  if (length < 0.5) return null;
  const build = parse_build(s.b);
  return {
    id,
    name: clean_name(s.name),
    paint: finite(s.paint, 1e3) ? Math.abs(Math.round(s.paint)) : 0,
    b: build ? build_code(build) : undefined,
    seed: s.seed,
    w: Number.isInteger(s.w) && finite(s.w, MAX_SEED) && (s.w as number) > 0 ? (s.w as number) : 1,
    t: s.t,
    p: s.p,
    q: (q as number[]).map((x) => x / length) as CarState["q"],
    v: s.v,
    steer: finite(s.steer, 1) ? s.steer : 0,
    brake: s.brake === true,
    boost: s.boost === true,
    best: finite(s.best, 1e7) && s.best > 0 ? s.best : null,
  };
}

// Both sides of a refused handshake get the same error, so only a player who typed a guess and never got in reads it
// as their own failure; a host who has never had company reads it as someone else's.
export function join_error_status(lock: RoomLock | null, had_peer: boolean, peers: number, error: string): string | null {
  if (!lock || had_peer || !PASSWORD_ERROR.test(error)) return null;
  if (lock.asked) return WRONG_PASSWORD;
  return peers === 0 ? TURNED_AWAY : null;
}

export function leader_of(self: string, ids: Iterable<string>): string {
  let leader = self;
  for (const id of ids) if (id < leader) leader = id;
  return leader;
}

/** Ties go to the lower seed, so peers seeing the same crowd pick the same map. */
export function most_common(values: number[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let best_count = 0;
  for (const [v, count] of counts) if (count > best_count || (count === best_count && best !== null && v < best)) [best, best_count] = [v, count];
  return best;
}

export function parse_seed(raw: string | null): number | null {
  if (raw === null || !/^\d{1,10}$/.test(raw)) return null;
  const seed = Number(raw);
  return seed <= MAX_SEED ? seed : null;
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

export class RateLimit {
  private times: number[] = [];

  constructor(
    private gap = CHAT_GAP_MS,
    private burst = CHAT_BURST,
  ) {}

  allow(now: number): boolean {
    while (this.times.length && now - this.times[0] >= CHAT_WINDOW_MS) this.times.shift();
    const last = this.times[this.times.length - 1];
    if (last !== undefined && now - last < this.gap) return false;
    if (this.times.length >= this.burst) return false;
    this.times.push(now);
    return true;
  }
}

export class Net {
  readonly id = selfId;
  readonly remotes = new Map<string, Remote>();
  /** Peers in this room on another seed, by id: their seed and when they were last heard (performance.now ms). */
  readonly foreign = new Map<string, Foreign>();
  /** Peers on this map, by id: when last heard (performance.now ms). Uncapped, unlike `remotes`, so every player elects the same leader. */
  readonly same_map = new Map<string, number>();
  status = "connecting";
  on_chat: ((name: string, text: string) => void) | null = null;
  private send_p2p: ((state: CarState) => void) | null = null;
  on_event: ((event: RaceEvent, from: Remote) => void) | null = null;
  private send_chat_p2p: ((msg: ChatMsg) => void) | null = null;
  private send_event_p2p: ((event: RaceEvent) => void) | null = null;
  private event_limits = new Map<string, RateLimit>();
  private channel: BroadcastChannel;
  private chat_limits = new Map<string, RateLimit>();
  private own_chat_limit = new RateLimit(OWN_CHAT_GAP_MS, OWN_CHAT_BURST);

  private name_: string;

  private readonly joined = performance.now();
  private readonly peer_ids = new Set<string>();
  private had_peer = false;

  /** `lock` locks the room: peers without the same password fail the trystero handshake and never connect. */
  constructor(
    readonly room: string,
    readonly seed: number,
    name: string,
    private readonly lock: RoomLock | null = null,
    /** Map identity stamped as `w`: `world_id` of the world kind. */
    readonly world = WORLD_VERSION,
  ) {
    this.name_ = clean_name(name);
    const password = lock?.password ?? null;
    // Same-browser tabs skip WebRTC, so a locked room keys its channel by the password too.
    this.channel = new BroadcastChannel(password === null ? `harepin:${room}` : `harepin-locked:${JSON.stringify([room, password])}`);
    this.channel.onmessage = (event: MessageEvent<unknown>) => this.receive_local(event.data);
    try {
      const p2p = joinRoom({ appId: APP_ID, ...(password === null ? {} : { password }) }, room, {
        onJoinError: ({ error }) => {
          this.status = join_error_status(lock, this.had_peer, this.peers, error) ?? this.status;
        },
      });
      const action = p2p.makeAction<CarState>("car");
      this.send_p2p = (state) => void action.send(state).catch(dropped);
      action.onMessage = (state, { peerId }) => this.receive(state, peerId);
      const chat = p2p.makeAction<ChatMsg>("chat");
      this.send_chat_p2p = (msg) => void chat.send(msg).catch(dropped);
      chat.onMessage = (msg, { peerId }) => this.receive_chat(msg, peerId);
      const events = p2p.makeAction<RaceEvent>("event");
      this.send_event_p2p = (event) => void events.send(event).catch(dropped);
      events.onMessage = (event, { peerId }) => this.receive_event(event, peerId);
      p2p.onPeerJoin = (peer) => {
        this.peer_ids.add(peer);
        this.had_peer = true;
        this.status = "online";
      };
      p2p.onPeerLeave = (peer) => {
        this.peer_ids.delete(peer);
        if (this.peers === 0) this.status = "searching";
        this.remotes.delete(peer);
        this.same_map.delete(peer);
        this.chat_limits.delete(peer);
        this.event_limits.delete(peer);
      };
      this.status = "searching";
    } catch (error) {
      console.warn("p2p unavailable, same-browser tabs only", error);
      this.status = "local only";
    }
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
    const stamped = { ...state, w: this.world };
    this.post({ kind: "car", id: this.id, data: stamped });
    this.send_p2p?.(stamped);
  }

  send_chat(text: string): string | null {
    const msg = sanitize_chat({ text, t: performance.now() });
    if (!msg || !this.own_chat_limit.allow(msg.t)) return null;
    this.post({ kind: "chat", id: this.id, data: msg });
    this.send_chat_p2p?.(msg);
    return msg.text;
  }

  /** A peer's name, with a short id suffix when someone else in the room (you included) uses the same one. */
  display_name(remote: Remote): string {
    const name = remote.latest.name;
    const taken = name === this.name || [...this.remotes.values()].some((r) => r !== remote && r.latest.name === name);
    return taken ? `${name} #${remote.id.slice(0, ID_SUFFIX)}` : name;
  }

  send_event(event: RaceEvent) {
    this.post({ kind: "event", id: this.id, data: event });
    this.send_event_p2p?.(event);
  }

  private post(packet: Packet) {
    this.channel.postMessage(packet);
  }

  private receive_local(raw: unknown) {
    if (!raw || typeof raw !== "object") return;
    const packet = raw as Record<string, unknown>;
    if (packet.kind === "car") this.receive(packet.data, packet.id);
    else if (packet.kind === "chat") this.receive_chat(packet.data, packet.id);
    else if (packet.kind === "event") this.receive_event(packet.data, packet.id);
  }

  private receive_chat(raw: unknown, sender: unknown) {
    const remote = this.known(sender);
    const msg = sanitize_chat(raw);
    if (!remote || !msg || !this.allow(this.chat_limits, remote.id)) return;
    this.on_chat?.(this.display_name(remote), msg.text);
  }

  private receive_event(raw: unknown, sender: unknown) {
    const remote = this.known(sender);
    const event = sanitize_event(raw);
    if (!remote || !event || !this.allow(this.event_limits, remote.id)) return;
    this.on_event?.(event, remote);
  }

  private known(sender: unknown): Remote | null {
    return typeof sender === "string" && sender !== this.id ? (this.remotes.get(sender) ?? null) : null;
  }

  private allow(limits: Map<string, RateLimit>, id: string): boolean {
    let limit = limits.get(id);
    if (!limit) limits.set(id, (limit = new RateLimit()));
    return limit.allow(performance.now());
  }

  private receive(raw: unknown, sender: unknown) {
    if (typeof sender !== "string" || sender === this.id) return;
    const state = sanitize(raw, sender);
    if (!state) return;
    const now = performance.now();
    // The same seed on another world version is another island: racing on it would mean racing on different roads.
    if (state.seed !== this.seed || state.w !== this.world) {
      this.foreign.set(state.id, { seed: state.seed, world: state.w ?? 1, seen: now });
      this.remotes.delete(state.id);
      this.same_map.delete(state.id);
      return;
    }
    this.foreign.delete(state.id);
    this.same_map.set(state.id, now);
    let remote = this.remotes.get(state.id);
    if (remote && state.t - remote.latest.t < MIN_GAP_MS && remote.snapshots.length) return;
    if (!remote) {
      if (this.remotes.size >= MAX_REMOTES) return;
      remote = { id: state.id, latest: state, snapshots: [], offset: now - state.t, seen: now };
      this.remotes.set(state.id, remote);
    }
    if (state.t <= remote.latest.t && remote.snapshots.length) return;
    // Clock offset tracks the fastest delivery seen, drifting up slowly so a one-off lucky packet doesn't pin it.
    remote.offset = Math.min(remote.offset + 0.5, now - state.t);
    remote.latest = state;
    remote.seen = now;
    remote.snapshots.push({ at: state.t, state });
    if (remote.snapshots.length > 40) remote.snapshots.shift();
  }

  prune() {
    const now = performance.now();
    for (const [id, remote] of this.remotes) if (now - remote.seen > TIMEOUT) this.remotes.delete(id);
    for (const [id, { seen }] of this.foreign) if (now - seen > TIMEOUT) this.foreign.delete(id);
    for (const [id, seen] of this.same_map) if (now - seen > TIMEOUT) this.same_map.delete(id);
  }

  /** The map most of the room is on, counting this one; null when that is already this one, so two players never swap. */
  foreign_seed(): { seed: number; kind: WorldKind } | null {
    if (!this.foreign.size) return null;
    const kinds = new Map(Object.values(WorldKind).map((kind) => [world_id(kind), kind]));
    const key = (world: number, seed: number) => world * 2 ** 32 + seed;
    const maps = [...this.foreign.values()].filter((f) => kinds.has(f.world)).map((f) => key(f.world, f.seed));
    const own = key(this.world, this.seed);
    for (let i = 0; i <= this.remotes.size; i++) maps.push(own);
    const map = most_common(maps);
    if (map === null || map === own) return null;
    return { seed: map % 2 ** 32, kind: kinds.get(Math.floor(map / 2 ** 32)) ?? WorldKind.ISLAND };
  }

  /**
   * The lowest id among this map's players speaks for the game in the directory. A player who typed a password and
   * never got in can't: their guess may be wrong, and they would list a lone copy of someone else's locked game.
   */
  get leader(): boolean {
    if (this.lock?.asked && !this.had_peer) return false;
    return performance.now() - this.joined > ELECT_MS && this.leader_id === this.id;
  }

  get leader_id(): string {
    return leader_of(this.id, this.same_map.keys());
  }

  /** Just joined, with room peers whose map no car packet has told yet: one of them may be the leader. */
  get settling(): boolean {
    if (performance.now() - this.joined > ELECT_MS) return false;
    for (const id of this.peer_ids) if (!this.same_map.has(id) && !this.foreign.has(id)) return true;
    return false;
  }

  render_time(remote: Remote): number {
    return performance.now() - remote.offset - DELAY;
  }
}
