import { mount } from "svelte";
import { MAX_EVENT_STARS, TIERS, tier_of, type Stars } from "../career/career";
import { mode_name } from "../menu/career-text";
import type { TierBadge } from "../net/net";
import type { Place } from "../career/place";
import type { MapSpec } from "../worldgen/kinds/kinds";
import { arrow_turn, next_up } from "./next-up";
import NextUp from "./NextUp.svelte";

const TURN_STEP = 5;
const DISTANCE_STEP = 10;

export interface NextUpTicket {
  id: string;
  tier: TierBadge;
  eyebrow: string;
  title: string;
  line: string;
  place: Place;
}

export interface NextUpHost {
  stars(): Stars;
  here: MapSpec;
  flag(id: string): { x: number; z: number } | null;
  travel(id: string): void;
  /** A menu or card covers the road: the travel key belongs to it. */
  blocked(): boolean;
}

/** The road's Next up ticket. The frame loop writes it, and only a change wakes the component. */
export class NextUpView {
  ticket = $state<NextUpTicket | null>(null);
  shown = $state(false);
  /** Metres to the flag, a multiple of `DISTANCE_STEP`; null with no flag to point at. */
  distance = $state<number | null>(null);
  turn = $state(0);
  private stars: Stars | null = null;

  constructor(readonly host: NextUpHost) {}

  update(x: number, z: number, heading: number, roaming: boolean) {
    const stars = this.host.stars();
    if (stars !== this.stars) {
      this.stars = stars;
      this.ticket = ticket_of(stars, this.host.here);
    }
    const shown = roaming && this.ticket !== null;
    if (shown !== this.shown) this.shown = shown;
    if (!shown || !this.ticket || !this.ticket.place.here) return;
    const flag = this.host.flag(this.ticket.id);
    const distance = flag ? Math.round(Math.hypot(flag.x - x, flag.z - z) / DISTANCE_STEP) * DISTANCE_STEP : null;
    if (distance !== this.distance) this.distance = distance;
    if (!flag) return;
    const turn = Math.round(arrow_turn(heading, flag.x - x, flag.z - z) / TURN_STEP) * TURN_STEP;
    if (turn !== this.turn) this.turn = turn;
  }
}

function ticket_of(stars: Stars, here: MapSpec): NextUpTicket | null {
  const up = next_up(stars, here);
  if (!up) return null;
  const { event, place } = up;
  const tier = tier_of(event);
  const have = stars[event.id] ?? 0;
  const run = have ? `best ${have} of ${MAX_EVENT_STARS} ★` : "not run yet";
  return {
    id: event.id,
    tier: (TIERS.indexOf(tier) + 1) as TierBadge,
    eyebrow: place.here ? `Next up · ${tier.name} ${tier.events.indexOf(event) + 1} of ${tier.events.length}` : "Next up · on another map",
    title: event.name,
    line: `${mode_name(event)} · ${run}`,
    place,
  };
}

export function show_next_up(host: NextUpHost): NextUpView {
  const view = new NextUpView(host);
  const target = document.createElement("div");
  target.className = "next-up-dock";
  (document.querySelector(".dock-top") ?? document.body).prepend(target);
  mount(NextUp, { target, props: { view } });
  return view;
}
