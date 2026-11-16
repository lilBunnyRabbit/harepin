<script lang="ts">
  import Icon from "../menu/ui/Icon.svelte";
  import KeyButton from "../menu/ui/KeyButton.svelte";
  import PlaceChip from "../menu/ui/PlaceChip.svelte";
  import Ticket from "../menu/ui/Ticket.svelte";
  import { TRAVEL_BUTTON, pad_label } from "./bindings";
  import type { NextUpView } from "./next-up-view.svelte";

  interface Props {
    view: NextUpView;
  }

  let { view }: Props = $props();

  const TRAVEL_HOLD_MS = 600;

  let travel_box = $state<HTMLElement>();

  const ticket = $derived(view.ticket);
  const travel = () => ticket && view.host.travel(ticket.id);
  const actions = $derived(ticket && !ticket.place.here ? travel_button : undefined);

  $effect(() => {
    view.travel_button = travel_box?.querySelector("button") ?? null;
  });

  function hold(event: KeyboardEvent) {
    if (event.code !== "Tab" || !view.shown || ticket?.place.here !== false || view.host.blocked()) return;
    event.preventDefault();
    if (!event.repeat) view.press(event.type === "keydown");
  }
</script>

<svelte:window onkeydown={hold} onkeyup={hold} />

{#if view.shown && ticket}
  <div class="next-up">
    <span class="next-up-mark" aria-hidden="true">
      {#if !ticket.place.here}
        <Icon name="icon-globe" />
      {:else}
        <svg viewBox="0 0 24 24" style:rotate={`${view.turn}deg`}><path d="M6 15l6-6 6 6" /></svg>
      {/if}
    </span>
    <Ticket tier={ticket.tier} eyebrow={ticket.eyebrow} title={ticket.title} reasons={[{ text: ticket.line }]} {actions}>
      {#snippet place()}
        {#if !ticket.place.here}
          <PlaceChip place={ticket.place} />
        {:else if view.distance !== null}
          <span class="next-up-where" data-mono>{view.distance} m</span>
        {/if}
      {/snippet}
    </Ticket>
  </div>
{/if}

{#snippet travel_button()}
  <span class="next-up-travel" bind:this={travel_box}>
    <KeyButton size="sm" hold={TRAVEL_HOLD_MS} onheld={travel} keys={{ key: "Hold Tab", pad: pad_label(TRAVEL_BUTTON), touch: "icon-globe" }}>Travel</KeyButton>
  </span>
{/snippet}

<style>
  .next-up {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--space-2);
    width: min(24rem, 100%);
    pointer-events: auto;
  }

  .next-up-mark {
    --icon-size: var(--text-xl);
    display: grid;
    place-items: center;
    width: var(--control-h-sm);
    height: var(--control-h-sm);
    margin-top: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--accent);
    color: var(--on-accent);
  }

  .next-up-mark svg {
    width: var(--space-5);
    height: var(--space-5);
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: rotate 120ms linear;
  }

  .next-up-where {
    color: var(--dim);
    font-size: var(--text-lg);
  }

  .next-up-where[data-mono] {
    font-family: var(--font-mono);
  }

  .next-up-travel {
    display: contents;
  }

  /* A phone's top corners hold restart and pause, its top centre the lap: the ticket sits under the left pair, clear of the road. */
  @media (pointer: coarse) {
    :global(.next-up-dock) {
      position: fixed;
      top: calc(var(--inset-top) + var(--control-h) + var(--space-2));
      left: var(--inset-left);
      width: min(20rem, 40vw);
      pointer-events: none;
    }

    .next-up {
      pointer-events: none;
    }

    /* Title on its own line, then the map chip and Travel side by side: three short rows clear the nitro button below. */
    .next-up :global(.ui-ticket) {
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      column-gap: var(--space-2);
    }

    .next-up :global(.ui-ticket-title) {
      display: contents;
    }

    .next-up :global(:is(.ui-ticket-eyebrow, .ui-ticket-title b)) {
      grid-column: 1 / -1;
    }

    .next-up :global(.ui-ticket-actions) {
      margin-top: 0;
      pointer-events: auto;
    }
  }

  @media (pointer: coarse), (max-height: 500px) {
    .next-up :global(.ui-ticket-reasons) {
      display: none;
    }

    .next-up :global(.ui-ticket) {
      padding: var(--space-2) var(--space-3);
    }

    .next-up :global(.ui-ticket-title) {
      gap: var(--space-1) var(--space-2);
    }

    .next-up :global(.ui-ticket-title b) {
      font-size: var(--text-lg);
    }

    .next-up :global(.ui-ticket-eyebrow) {
      font-size: var(--text-2xs);
    }
  }
</style>
