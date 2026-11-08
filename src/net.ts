import { joinRoom, selfId } from "trystero";

// A type alias, not an interface: trystero's DataPayload needs the implicit index signature only aliases get.
export type CarState = {
  id: string;
  name: string;
  paint: number;
  seed: number;
  t: number;
  p: [number, number, number];
  q: [number, number, number, number];
  v: [number, number, number];
  steer: number;
  brake: boolean;
  best: number | null;
};

export type ChatMsg = { text: string; t: number };

type Packet = { kind: "car"; id: string; data: CarState } | { kind: "chat"; id: string; data: ChatMsg };

interface Snapshot {
  at: number;
  state: CarState;
}

export interface Remote {
  id: string;
  latest: CarState;
  snapshots: Snapshot[];
  offset: number;
  seen: number;
}

const DELAY = 110;
const TIMEOUT = 4000;
const MAX_REMOTES = 16;
const MIN_GAP_MS = 25;
const WORLD_LIMIT = 5000;
const NAME_LENGTH = 24;
const CHAT_LENGTH = 140;
const CHAT_GAP_MS = 800;
const CHAT_BURST = 5;
const CHAT_WINDOW_MS = 10_000;

const MAX_SEED = 0xffffffff;

const finite = (v: unknown, limit: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit;
const triple = (v: unknown, limit: number): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((x) => finite(x, limit));

// Peers are untrusted: anything that reaches the scene (positions, quaternions, names) is shape-checked and clamped
// here, so one bad or hostile client can't put NaN into another player's renderer or flood it with cars.
function sanitize(raw: unknown, id: string): CarState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (!finite(s.t, 1e12) || !triple(s.p, WORLD_LIMIT) || !triple(s.v, 500)) return null;
  if (!finite(s.seed, MAX_SEED) || !Number.isInteger(s.seed) || s.seed < 0) return null;
  const q = s.q;
  if (!Array.isArray(q) || q.length !== 4 || !q.every((x) => finite(x, 1.01))) return null;
  const length = Math.hypot(...(q as number[]));
  if (length < 0.5) return null;
  return {
    id,
    name: typeof s.name === "string" ? s.name.slice(0, NAME_LENGTH) : "Player",
    paint: finite(s.paint, 1e3) ? Math.abs(Math.round(s.paint)) : 0,
    seed: s.seed,
    t: s.t,
    p: s.p,
    q: (q as number[]).map((x) => x / length) as CarState["q"],
    v: s.v,
    steer: finite(s.steer, 1) ? s.steer : 0,
    brake: s.brake === true,
    best: finite(s.best, 1e7) && s.best > 0 ? s.best : null,
  };
}

export function parse_seed(raw: string | null): number | null {
  if (raw === null || !/^\d{1,10}$/.test(raw)) return null;
  const seed = Number(raw);
  return seed <= MAX_SEED ? seed : null;
}

export function sanitize_chat(raw: unknown): ChatMsg | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.text !== "string" || !finite(m.t, 1e12)) return null;
  const text = [...m.text.replace(/\p{C}/gu, "").trim()].slice(0, CHAT_LENGTH).join("").trim();
  return text ? { text, t: m.t } : null;
}

export class RateLimit {
  private times: number[] = [];

  allow(now: number): boolean {
    while (this.times.length && now - this.times[0] >= CHAT_WINDOW_MS) this.times.shift();
    const last = this.times[this.times.length - 1];
    if (last !== undefined && now - last < CHAT_GAP_MS) return false;
    if (this.times.length >= CHAT_BURST) return false;
    this.times.push(now);
    return true;
  }
}

export class Net {
  readonly id = selfId;
  readonly remotes = new Map<string, Remote>();
  /** Peers in this room on another seed, by id, with when they were last heard (performance.now ms). */
  readonly foreign = new Map<string, number>();
  peers = 0;
  status = "connecting";
  on_chat: ((name: string, text: string) => void) | null = null;
  private send_p2p: ((state: CarState) => void) | null = null;
  private send_chat_p2p: ((msg: ChatMsg) => void) | null = null;
  private channel: BroadcastChannel;
  private chat_limits = new Map<string, RateLimit>();
  private own_chat_limit = new RateLimit();

  constructor(
    readonly room: string,
    readonly seed: number,
  ) {
    this.channel = new BroadcastChannel(`harepin:${room}`);
    this.channel.onmessage = (event: MessageEvent<unknown>) => this.receive_local(event.data);
    try {
      const p2p = joinRoom({ appId: "lilbunnyrabbit-harepin" }, room);
      const action = p2p.makeAction<CarState>("car");
      this.send_p2p = (state) => void action.send(state);
      action.onMessage = (state, { peerId }) => this.receive(state, peerId);
      const chat = p2p.makeAction<ChatMsg>("chat");
      this.send_chat_p2p = (msg) => void chat.send(msg);
      chat.onMessage = (msg, { peerId }) => this.receive_chat(msg, peerId);
      p2p.onPeerJoin = () => {
        this.peers++;
        this.status = "online";
      };
      p2p.onPeerLeave = (peer) => {
        this.peers = Math.max(0, this.peers - 1);
        if (this.peers === 0) this.status = "searching";
        this.remotes.delete(peer);
        this.chat_limits.delete(peer);
      };
      this.status = "searching";
    } catch (error) {
      console.warn("p2p unavailable, same-browser tabs only", error);
      this.status = "local only";
    }
  }

  send(state: CarState) {
    this.post({ kind: "car", id: this.id, data: state });
    this.send_p2p?.(state);
  }

  send_chat(text: string): string | null {
    const msg = sanitize_chat({ text, t: performance.now() });
    if (!msg || !this.own_chat_limit.allow(msg.t)) return null;
    this.post({ kind: "chat", id: this.id, data: msg });
    this.send_chat_p2p?.(msg);
    return msg.text;
  }

  private post(packet: Packet) {
    this.channel.postMessage(packet);
  }

  private receive_local(raw: unknown) {
    if (!raw || typeof raw !== "object") return;
    const packet = raw as Record<string, unknown>;
    if (packet.kind === "car") this.receive(packet.data, packet.id);
    else if (packet.kind === "chat") this.receive_chat(packet.data, packet.id);
  }

  private receive_chat(raw: unknown, sender: unknown) {
    if (typeof sender !== "string" || sender === this.id) return;
    const remote = this.remotes.get(sender);
    if (!remote) return;
    const msg = sanitize_chat(raw);
    if (!msg) return;
    let limit = this.chat_limits.get(sender);
    if (!limit) this.chat_limits.set(sender, (limit = new RateLimit()));
    if (!limit.allow(performance.now())) return;
    this.on_chat?.(remote.latest.name, msg.text);
  }

  private receive(raw: unknown, sender: unknown) {
    if (typeof sender !== "string" || sender === this.id) return;
    const state = sanitize(raw, sender);
    if (!state) return;
    const now = performance.now();
    if (state.seed !== this.seed) {
      this.foreign.set(state.id, now);
      this.remotes.delete(state.id);
      return;
    }
    this.foreign.delete(state.id);
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
    for (const [id, seen] of this.foreign) if (now - seen > TIMEOUT) this.foreign.delete(id);
  }

  render_time(remote: Remote): number {
    return performance.now() - remote.offset - DELAY;
  }
}
