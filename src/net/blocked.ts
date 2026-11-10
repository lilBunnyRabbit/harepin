// One failed SDP exchange is often a peer that left mid-handshake; only failures that keep coming with nobody connected
// mean the network refuses peer-to-peer.
const MIN_FAILURES = 2;
const BLOCKED_AFTER_MS = 15_000;
const QUIET_MS = 30_000;

export class BlockedWatch {
  private count = 0;
  private first = 0;
  private last = 0;

  fail(now: number) {
    if (this.count === 0 || now - this.last >= QUIET_MS) {
      this.count = 0;
      this.first = now;
    }
    this.count++;
    this.last = now;
  }

  blocked(now: number): boolean {
    return this.count >= MIN_FAILURES && now - this.first >= BLOCKED_AFTER_MS && now - this.last < QUIET_MS;
  }

  clear() {
    this.count = 0;
  }
}
