import { joinRoom, selfId } from "trystero";

// A type alias, not an interface: trystero's DataPayload needs the implicit index signature only aliases get.
export type CarState = {
  id: string;
  name: string;
  paint: number;
  t: number;
  p: [number, number, number];
  q: [number, number, number, number];
  v: [number, number, number];
  steer: number;
  brake: boolean;
  best: number | null;
};

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

const finite = (v: unknown, limit: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit;
const triple = (v: unknown, limit: number): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((x) => finite(x, limit));

// Peers are untrusted: anything that reaches the scene (positions, quaternions, names) is shape-checked and clamped
// here, so one bad or hostile client can't put NaN into another player's renderer or flood it with cars.
function sanitize(raw: unknown, id: string): CarState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (!finite(s.t, 1e12) || !triple(s.p, WORLD_LIMIT) || !triple(s.v, 500)) return null;
  const q = s.q;
  if (!Array.isArray(q) || q.length !== 4 || !q.every((x) => finite(x, 1.01))) return null;
  const length = Math.hypot(...(q as number[]));
  if (length < 0.5) return null;
  return {
    id,
    name: typeof s.name === "string" ? s.name.slice(0, NAME_LENGTH) : "Player",
    paint: finite(s.paint, 1e3) ? Math.abs(Math.round(s.paint)) : 0,
    t: s.t,
    p: s.p,
    q: (q as number[]).map((x) => x / length) as CarState["q"],
    v: s.v,
    steer: finite(s.steer, 1) ? s.steer : 0,
    brake: s.brake === true,
    best: finite(s.best, 1e7) && s.best > 0 ? s.best : null,
  };
}

export class Net {
  readonly id = selfId;
  readonly remotes = new Map<string, Remote>();
  peers = 0;
  status = "connecting";
  private send_p2p: ((state: CarState) => void) | null = null;
  private channel: BroadcastChannel;

  constructor(readonly room: string) {
    this.channel = new BroadcastChannel(`harepin:${room}`);
    this.channel.onmessage = (event) => this.receive(event.data, (event.data as { id?: unknown })?.id);
    try {
      const p2p = joinRoom({ appId: "lilbunnyrabbit-harepin" }, room);
      const action = p2p.makeAction<CarState>("car");
      this.send_p2p = (state) => void action.send(state);
      action.onMessage = (state, { peerId }) => this.receive(state, peerId);
      p2p.onPeerJoin = () => {
        this.peers++;
        this.status = "online";
      };
      p2p.onPeerLeave = (peer) => {
        this.peers = Math.max(0, this.peers - 1);
        if (this.peers === 0) this.status = "searching";
        this.remotes.delete(peer);
      };
      this.status = "searching";
    } catch (error) {
      console.warn("p2p unavailable, same-browser tabs only", error);
      this.status = "local only";
    }
  }

  send(state: CarState) {
    this.channel.postMessage(state);
    this.send_p2p?.(state);
  }

  private receive(raw: unknown, sender: unknown) {
    if (typeof sender !== "string" || sender === this.id) return;
    const state = sanitize(raw, sender);
    if (!state) return;
    const now = performance.now();
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
  }

  render_time(remote: Remote): number {
    return performance.now() - remote.offset - DELAY;
  }
}
