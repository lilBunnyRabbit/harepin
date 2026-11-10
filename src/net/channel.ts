import type { DataPayload, Room } from "trystero";
import type { RateLimit } from "./rate-limit";

export interface Channel<T> {
  /** To every peer, or only to `to`. */
  send(data: T, to?: string): void;
  subscribe(fn: (data: T, sender: string) => void): () => void;
}

/** Shape-checks a peer's payload; null drops it. */
export type Sanitize<T> = (raw: unknown, sender: string) => T | null;

const dropped = (error: unknown) => console.debug("net: send dropped", error);

/**
 * One room's transports: trystero for remote peers and a BroadcastChannel for same-browser tabs. Every channel's
 * payload is sanitized and, with a `limit`, rate-limited per sender before any subscriber sees it.
 */
export class Link {
  private readonly receivers = new Map<string, (raw: unknown, sender: string) => void>();
  private readonly limits: Map<string, RateLimit>[] = [];

  constructor(
    private readonly self: string,
    private readonly local: BroadcastChannel,
    private readonly room: Room | null,
  ) {
    local.onmessage = (event: MessageEvent<unknown>) => this.receive_local(event.data);
  }

  channel<T extends DataPayload>(name: string, sanitize: Sanitize<T>, limit?: () => RateLimit): Channel<T> {
    const subscribers = new Set<(data: T, sender: string) => void>();
    const limits = new Map<string, RateLimit>();
    if (limit) this.limits.push(limits);
    const receive = (raw: unknown, sender: string) => {
      if (sender === this.self) return;
      const data = sanitize(raw, sender);
      if (!data) return;
      if (limit) {
        let rate = limits.get(sender);
        if (!rate) limits.set(sender, (rate = limit()));
        if (!rate.allow(performance.now())) return;
      }
      for (const fn of subscribers) fn(data, sender);
    };
    this.receivers.set(name, receive);
    const action = this.room?.makeAction<T>(name) ?? null;
    if (action) action.onMessage = (data, { peerId }) => receive(data, peerId);
    return {
      send: (data, to) => {
        this.local.postMessage(to === undefined ? { kind: name, id: this.self, data } : { kind: name, id: this.self, data, to });
        void action?.send(data, to === undefined ? undefined : { target: to }).catch(dropped);
      },
      subscribe: (fn) => {
        subscribers.add(fn);
        return () => subscribers.delete(fn);
      },
    };
  }

  /** Drops a departed peer's rate limits. */
  forget(peer: string) {
    for (const limits of this.limits) limits.delete(peer);
  }

  private receive_local(raw: unknown) {
    if (!raw || typeof raw !== "object") return;
    const packet = raw as Record<string, unknown>;
    if (typeof packet.kind !== "string" || typeof packet.id !== "string") return;
    if (packet.to !== undefined && packet.to !== this.self) return;
    this.receivers.get(packet.kind)?.(packet.data, packet.id);
  }
}
