// Ready is resent on a beat so newcomers hear it; one that stops arriving lapses, so a player who left stops counting.
export const READY_RESEND_MS = 1000;
export const READY_TTL_MS = 3000;

export interface RaceCall {
  laps: number;
  route: string;
}

// Spelled out, not `RaceCall &`: trystero payloads need the index signature only type aliases get.
export type ReadyMsg = { ready: true; laps: number; route: string } | { ready: false };

interface Heard {
  name: string;
  call: RaceCall;
  at: number;
}

export interface ReadyStatus {
  names: string[];
  total: number;
  /** What the leader readied for, which is what an all-ready start runs; null while the leader isn't ready. */
  next: RaceCall | null;
}

export class ReadySet {
  private readonly heard = new Map<string, Heard>();

  hear(id: string, name: string, msg: ReadyMsg, now: number) {
    if (msg.ready) this.heard.set(id, { name, call: { laps: msg.laps, route: msg.route }, at: now });
    else this.heard.delete(id);
  }

  clear() {
    this.heard.clear();
  }

  private fresh(id: string, now: number): Heard | null {
    const heard = this.heard.get(id);
    return heard && now - heard.at <= READY_TTL_MS ? heard : null;
  }

  everyone(own: RaceCall | null, present: Iterable<string>, now: number): boolean {
    if (!own) return false;
    for (const id of present) if (!this.fresh(id, now)) return false;
    return true;
  }

  status(own: RaceCall | null, present: Iterable<string>, leader: string, self: string, now: number): ReadyStatus {
    const names = own ? ["you"] : [];
    let total = 1;
    for (const id of present) {
      total++;
      const heard = this.fresh(id, now);
      if (heard) names.push(heard.name);
    }
    const next = leader === self ? own : (this.fresh(leader, now)?.call ?? null);
    return { names, total, next };
  }
}
