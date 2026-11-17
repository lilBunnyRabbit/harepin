<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { CARS } from "../car/cars";
  import CarStill from "../menu/CarStill.svelte";
  import Chip from "../menu/ui/Chip.svelte";
  import ClassBadge from "../menu/ui/ClassBadge.svelte";
  import KeyLink from "../menu/ui/KeyLink.svelte";
  import PageFrame from "../menu/ui/PageFrame.svelte";
  import PlaceLine from "../menu/ui/PlaceLine.svelte";
  import PrimaryAction from "../menu/ui/PrimaryAction.svelte";
  import { mode_name } from "../modes/modes";
  import { MAX_EVENT_STARS, TIERS, tier_of } from "./career";
  import type { GateView } from "./gate-card.svelte";
  import { event_place, gate_row, marks_of } from "./gate";

  const HOLD_MS = 600;
  const KEYS = { key: "Hold Enter", pad: "Hold A", touch: "icon-play" };

  interface Props {
    view: GateView;
    onstart: () => void;
    onmore: () => void;
    onleave: () => void;
  }

  let { view, onstart, onmore, onleave }: Props = $props();

  const marker = $derived(view.marker);
  const event = $derived(marker?.event);
  const choice = $derived(view.car !== null && "row" in view.car);
  const chosen = $derived(choice ? (gate_row(view.shelves, view.picked).find((c) => c.code === view.picked) ?? null) : null);
  const lent = $derived(view.car && "lent" in view.car ? view.car.lent : null);
  const lock = $derived.by(() => {
    if (!event || view.open) return "";
    const tier = tier_of(event);
    const before = TIERS[TIERS.indexOf(tier) - 1];
    return `Opens at ${tier.opens_at} ★ in ${before?.name ?? "the tier before"}`;
  });
  const car_note = $derived(!chosen ? "" : chosen.fitted ? "Driving now" : chosen.sub && chosen.sub !== CARS[chosen.build.car].name ? chosen.sub : "Fits");
  const startable = $derived(view.open && (!choice || chosen !== null));

  // Keys reach the hold button with nothing else focused; the chat's Enter skips a focused button.
  // A dialog that closed in this same turn (the road map's Go to flag) still holds the focus, hidden: that counts as nothing.
  const take_focus: Attachment<HTMLElement> = (node) => {
    const active = document.activeElement;
    const free = active === document.body || (active instanceof HTMLElement && !active.checkVisibility());
    if (!view.open || !free || document.documentElement.dataset.input === "touch") return;
    node.querySelector<HTMLElement>(".ui-primary")?.focus({ preventScroll: true, focusVisible: false });
  };

  let pressed = 0;

  // A tap counts only when it began on the card's button: the Enter that sent the car here is still down as the card shows.
  function key_down(press: KeyboardEvent) {
    if (press.key === "Enter" && !press.repeat && press.target instanceof Element && press.target.closest(".event-card .ui-primary")) pressed = press.timeStamp;
  }

  function key_up(press: KeyboardEvent) {
    if (press.key !== "Enter" || !pressed) return;
    const tap = press.timeStamp - pressed < HOLD_MS;
    pressed = 0;
    if (tap && choice && view.open) onmore();
  }
</script>

<svelte:window onkeydown={key_down} onkeyup={key_up} />

{#if marker && event}
  {#key `${event.id}:${view.open}`}
    <div class="event-card" role="group" aria-label={event.name} {@attach take_focus}>
      <PageFrame floor back={{ to: "Road", go: onleave }}>
        <div class="gate-spot">
          <section class="gate-card">
            <header class="gate-what">
              <span class="gate-eyebrow">{event_place(event)} · {mode_name(event)}</span>
              <h2 class="gate-title">{event.name}</h2>
              <PlaceLine place={{ here: true }} tail={view.map} />
            </header>
            {#if lock}
              <span class="gate-lock">{lock}</span>
            {:else}
              <div class="gate-marks">
                {#each marks_of(event) as mark (mark.stars)}
                  <span class="gate-mark" data-got={view.have >= mark.stars ? "" : undefined} aria-label={`${mark.stars} of ${MAX_EVENT_STARS} stars: ${mark.text}`}>
                    <Chip inner><i>{"★".repeat(mark.stars)}</i><span>{mark.text}</span></Chip>
                  </span>
                {/each}
              </div>
            {/if}
            {#if view.open && chosen}
              <div class="gate-car">
                <CarStill car={chosen.build.car} />
                <div class="gate-car-text">
                  <b>{chosen.title}<ClassBadge rating={chosen.rating} /></b>
                  <small>{car_note}</small>
                </div>
              </div>
            {:else if view.open && lent}
              <div class="gate-car">
                <CarStill car={lent} />
                <div class="gate-car-text">
                  <b>{CARS[lent].name}</b>
                  <small>Lent for this event</small>
                </div>
              </div>
            {/if}
          </section>
        </div>
        {#snippet primary()}
          {#if view.open}
            {#if choice}<KeyLink keys={{ key: "Enter", pad: "A" }} onclick={onmore}>Change car</KeyLink>{/if}
            <PrimaryAction keys={KEYS} hold={HOLD_MS} onheld={onstart} disabled={!startable}><span class="gate-hold">Hold: </span>Start{chosen ? ` in ${chosen.title}` : ""}</PrimaryAction>
          {/if}
        {/snippet}
      </PageFrame>
    </div>
  {/key}
{/if}

<style>
  .gate-spot {
    display: grid;
    place-items: end;
    height: 100%;
    pointer-events: none;
  }

  .gate-card {
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
    width: min(27.5rem, 100%);
    padding: var(--pad);
    border: 1px solid var(--line-strong);
    border-radius: var(--card-radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    pointer-events: auto;
  }

  .gate-what {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .gate-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .gate-title {
    margin: 0 0 var(--gap-xs);
    font-size: var(--type-h1);
    font-weight: 800;
    line-height: 1.1;
    text-wrap: balance;
  }

  .gate-lock {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .gate-marks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm);
  }

  .gate-mark i {
    color: var(--dim);
    font-style: normal;
  }

  .gate-mark span {
    font-family: var(--font-mono);
  }

  .gate-mark[data-got] i {
    color: var(--cottontail);
  }

  .gate-car {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    padding: var(--gap-sm) var(--gap-md) var(--gap-sm) var(--gap-sm);
    border-radius: var(--radius-sm);
    background: var(--row);
  }

  .gate-car > :global(.still) {
    flex: none;
    width: 6.5rem;
    aspect-ratio: 16 / 9;
  }

  .gate-car-text {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .gate-car-text b {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    font-size: var(--type-h3);
    font-weight: 800;
    line-height: 1.15;
  }

  .gate-car-text small {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .gate-hold {
    display: none;
  }

  :global(:root[data-input="touch"]) .gate-hold {
    display: inline;
  }

  @media (max-height: 500px) {
    .gate-card {
      width: min(21.25rem, 100%);
    }

    .gate-car > :global(.still) {
      width: 4.25rem;
    }
  }
</style>
