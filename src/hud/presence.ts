import type { Net } from "../net/net";
import { $ } from "./hud";

const TICK_MS = 1000;
const SEND_MS = 3000;
// Several arrivals inside this gap share one toast, so a full room joining at once doesn't flash names for a minute.
const TOAST_GAP_MS = 4000;

export interface PresenceHost {
  net: Net;
  elsewhere(): number | null;
  watch(on: boolean): void;
  toast(text: string): void;
  open_online(): void;
}

function said(names: string[], verb: string): string {
  return names.length === 1 ? `${names[0]} ${verb}` : `${names[0]} and ${names.length - 1} more ${verb}`;
}

export class Presence {
  private readonly chip = $("online-chip", HTMLButtonElement);
  private readonly here_el = $("online-here");
  private readonly online_el = $("online-total");
  private readonly known = new Map<string, string>();
  private joined: string[] = [];
  private left: string[] = [];
  private last_toast = 0;
  private timer = 0;
  private shown = "";
  private online = 0;
  private last_send = 0;

  constructor(private readonly host: PresenceHost) {}

  start() {
    this.chip.addEventListener("click", this.open);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop() {
    clearInterval(this.timer);
    this.chip.removeEventListener("click", this.open);
    this.host.watch(false);
  }

  private readonly open = () => this.host.open_online();

  // Only the leader watches the directory and tells its room, so links grow with games rather than players. Until a
  // new leader's directory connects, the count the old one sent stays up.
  private tick() {
    const { net } = this.host;
    const now = performance.now();
    const here = 1 + net.same_map.size;
    const leader = net.leader;
    this.host.watch(leader && !document.hidden);
    if (leader) {
      const elsewhere = this.host.elsewhere();
      if (elsewhere !== null) this.online = here + elsewhere;
      if (here > 1 && this.online > 0 && now - this.last_send >= SEND_MS) {
        net.send_online(Math.max(here, this.online));
        this.last_send = now;
      }
    } else {
      const heard = net.leader_online;
      if (heard !== null) this.online = heard;
    }
    this.draw(here, Math.max(here, this.online));
    this.track(net, now);
  }

  private draw(here: number, online: number) {
    const key = `${here}/${online}`;
    if (key === this.shown) return;
    this.shown = key;
    this.chip.hidden = online <= 1;
    this.chip.toggleAttribute("data-both", here > 1 && online > here);
    this.chip.toggleAttribute("data-alone", here === 1);
    this.here_el.textContent = String(here);
    this.online_el.textContent = String(online);
    this.chip.title = `${here} on this map, ${online} online. Open the Online tab`;
  }

  private track(net: Net, now: number) {
    // Players already here show up over the first seconds after joining; they didn't just arrive.
    const quiet = net.electing;
    for (const id of net.same_map.keys()) {
      if (this.known.has(id)) continue;
      const name = net.name_of(id);
      this.known.set(id, name);
      if (!quiet) this.joined.push(name);
    }
    for (const [id, name] of this.known) {
      if (net.same_map.has(id)) continue;
      this.known.delete(id);
      if (!quiet) this.left.push(name);
    }
    if (now - this.last_toast < TOAST_GAP_MS) return;
    if (this.joined.length) {
      this.host.toast(said(this.joined, "joined"));
      this.joined = [];
    } else if (this.left.length) {
      this.host.toast(said(this.left, "left"));
      this.left = [];
    } else return;
    this.last_toast = now;
  }
}
