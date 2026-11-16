<script lang="ts">
  import { HOLD_EVENT } from "../menu/dom";
  import Icon from "../menu/ui/Icon.svelte";
  import KeyButton from "../menu/ui/KeyButton.svelte";
  import PlaceChip from "../menu/ui/PlaceChip.svelte";
  import Ticket from "../menu/ui/Ticket.svelte";
  import type { NextUpView } from "./next-up-view.svelte";

  interface Props {
    view: NextUpView;
  }

  let { view }: Props = $props();

  const TRAVEL_HOLD_MS = 600;

  let travel_box = $state<HTMLElement>();

  const ticket = $derived(view.ticket);
  const travel = () => ticket && view.host.travel(ticket.id);

  function hold(event: KeyboardEvent) {
    if (event.code !== "Tab" || !view.shown || ticket?.place.here !== false || view.host.blocked()) return;
    event.preventDefault();
    if (event.repeat) return;
    travel_box?.querySelector("button")?.dispatchEvent(new CustomEvent(HOLD_EVENT, { detail: event.type === "keydown" }));
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
    <Ticket tier={ticket.tier} eyebrow={ticket.eyebrow} title={ticket.title} reasons={[{ text: ticket.line }]}>
      {#snippet place()}
        {#if !ticket.place.here}
          <PlaceChip place={ticket.place} />
        {:else if view.distance !== null}
          <span class="next-up-where" data-mono>{view.distance} m</span>
        {/if}
      {/snippet}
    </Ticket>
    {#if !ticket.place.here}
      <div class="next-up-travel" bind:this={travel_box}>
        <KeyButton size="md" hold={TRAVEL_HOLD_MS} onheld={travel} keys={{ key: "Hold Tab", touch: "icon-globe" }}>Travel to {ticket.place.name}</KeyButton>
      </div>
    {/if}
  </div>
{/if}

<style>
  .next-up {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-2) var(--space-3);
    width: min(28rem, 100%);
    pointer-events: auto;
  }

  .next-up-mark {
    --icon-size: var(--text-2xl);
    display: grid;
    place-items: center;
    width: calc(var(--control-h-lg) + var(--space-1));
    height: calc(var(--control-h-lg) + var(--space-1));
    border-radius: var(--radius-full);
    background: var(--accent);
    color: var(--on-accent);
  }

  .next-up-mark svg {
    width: var(--space-6);
    height: var(--space-6);
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
    grid-column: 2;
  }

  @media (pointer: coarse) {
    :global(.next-up-dock) {
      position: fixed;
      top: calc(var(--inset-top) + var(--control-h) + var(--space-2));
      left: 50%;
      translate: -50% 0;
      width: min(22rem, var(--phone-centre));
    }

    .next-up {
      pointer-events: none;
    }

    .next-up-travel {
      pointer-events: auto;
    }
  }

  @media (max-height: 500px) {
    .next-up {
      width: min(22rem, 100%);
    }

    .next-up :global(.ui-ticket-reasons) {
      display: none;
    }

    .next-up-mark {
      width: var(--control-h);
      height: var(--control-h);
    }
  }
</style>
