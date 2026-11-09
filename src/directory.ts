import { joinRoom, selfId, type Room } from "trystero";
import { APP_ID, MAX_SEED, RateLimit, clean_name } from "./net";

export const DIRECTORY_ROOM = "harepin-directory";
const ANNOUNCE_MS = 3000;
// About three missed announces, plus slack for a late timer in a background tab.
const EXPIRE_MS = ANNOUNCE_MS * 3 + 1000;
export const ROOM_LENGTH = 32;
export const PASSWORD_LENGTH = 64;
const MAX_PLAYERS = 64;
const MAX_ENTRIES = 256;
const VERSION = /^[0-9A-Za-z.+-]{1,24}$/;
const ANNOUNCE_GAP_MS = 1000;
const ANNOUNCE_BURST = 6;
const MAX_RECEIVE_BYTES = 16 * 1024;
const PASSWORD_KEY = "harepin:room-password";

// A type alias, not an interface: trystero's DataPayload needs the implicit index signature only aliases get.
export type Announce = {
  room: string;
  seed: number;
  host: string;
  players: number;
  locked: boolean;
  version: string;
};

export interface Server extends Announce {
  key: string;
  here: boolean;
}

interface Entry {
  announce: Announce;
  seen: number;
}

export const DirectoryStatus = {
  CONNECTING: "connecting",
  ONLINE: "online",
  OFFLINE: "offline",
} as const;
export type DirectoryStatus = (typeof DirectoryStatus)[keyof typeof DirectoryStatus];

export function clean_room(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const room = raw.trim();
  if (!room || /\p{C}/u.test(room) || [...room].length > ROOM_LENGTH || room === DIRECTORY_ROOM) return null;
  return room;
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
  return { room, seed: a.seed, host: clean_name(a.host), players: Math.min(a.players, MAX_PLAYERS), locked: a.locked, version: a.version };
}

// One row per game however many of its players announce; the lowest peer id names the host, so all viewers agree.
export function group_servers(entries: Iterable<readonly [string, Announce]>, self: string): Server[] {
  const servers = new Map<string, Server & { host_id: string }>();
  for (const [id, a] of entries) {
    const key = JSON.stringify([a.room, a.seed, a.locked, a.version]);
    const known = servers.get(key);
    if (!known) {
      servers.set(key, { ...a, key, here: id === self, host_id: id });
      continue;
    }
    known.players = Math.max(known.players, a.players);
    known.here ||= id === self;
    if (id < known.host_id) [known.host, known.host_id] = [a.host, id];
  }
  return [...servers.values()]
    .map(({ host_id: _, ...server }) => server)
    .sort((a, b) => Number(b.here) - Number(a.here) || b.players - a.players || a.room.localeCompare(b.room) || a.seed - b.seed);
}

// A saved password only ever applies to the room it was entered for; landing anywhere else forgets it.
export function load_password(room: string): string | null {
  try {
    const text = sessionStorage.getItem(PASSWORD_KEY);
    if (text === null) return null;
    const saved: unknown = JSON.parse(text);
    if (saved && typeof saved === "object" && "room" in saved && saved.room === room && "password" in saved) {
      const password = clean_password(saved.password);
      if (password !== null) return password;
    }
    sessionStorage.removeItem(PASSWORD_KEY);
  } catch (error) {
    console.warn("directory: saved room password unreadable", error);
  }
  return null;
}

export function save_password(room: string, password: string | null) {
  try {
    if (password === null) sessionStorage.removeItem(PASSWORD_KEY);
    else sessionStorage.setItem(PASSWORD_KEY, JSON.stringify({ room, password }));
  } catch (error) {
    console.warn("directory: room password not kept", error);
  }
}

const dropped = (error: unknown) => console.debug("directory: announce dropped", error);

export class Directory {
  status: DirectoryStatus = DirectoryStatus.CONNECTING;
  private readonly entries = new Map<string, Entry>();
  private readonly limits = new Map<string, RateLimit>();
  private room: Room | null = null;
  private send: ((announce: Announce, target?: string) => void) | null = null;
  private timer = 0;

  constructor(private readonly own: () => Announce) {}

  start() {
    try {
      const room = joinRoom({ appId: APP_ID, maxReceiveBytes: MAX_RECEIVE_BYTES }, DIRECTORY_ROOM);
      const action = room.makeAction<Announce>("announce");
      this.send = (announce, target) => void action.send(announce, target ? { target } : undefined).catch(dropped);
      action.onMessage = (raw, { peerId }) => this.receive(raw, peerId);
      room.onPeerJoin = (peer) => {
        this.status = DirectoryStatus.ONLINE;
        this.announce(peer);
      };
      room.onPeerLeave = (peer) => {
        this.entries.delete(peer);
        this.limits.delete(peer);
      };
      this.room = room;
    } catch (error) {
      console.warn("directory unavailable, the server list shows this game only", error);
      this.status = DirectoryStatus.OFFLINE;
    }
    this.timer = window.setInterval(() => this.announce(), ANNOUNCE_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.room?.leave().catch((error: unknown) => console.debug("directory: leave failed", error));
    this.room = null;
    this.send = null;
  }

  list(): Server[] {
    const now = performance.now();
    for (const [id, entry] of this.entries) if (now - entry.seen > EXPIRE_MS) this.entries.delete(id);
    const own = sanitize_announce(this.own());
    const entries: [string, Announce][] = [...this.entries].map(([id, entry]) => [id, entry.announce]);
    if (own) entries.push([selfId, own]);
    return group_servers(entries, selfId);
  }

  private announce(target?: string) {
    const own = sanitize_announce(this.own());
    if (own) this.send?.(own, target);
  }

  private receive(raw: unknown, peer: string) {
    if (peer === selfId) return;
    let limit = this.limits.get(peer);
    if (!limit) this.limits.set(peer, (limit = new RateLimit(ANNOUNCE_GAP_MS, ANNOUNCE_BURST)));
    if (!limit.allow(performance.now())) return;
    const announce = sanitize_announce(raw);
    if (!announce || (!this.entries.has(peer) && this.entries.size >= MAX_ENTRIES)) return;
    this.entries.set(peer, { announce, seen: performance.now() });
  }
}
