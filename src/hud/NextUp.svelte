<script lang="ts">
  import { distance_text } from "../menu/maps";
  import Icon from "../menu/ui/Icon.svelte";
  import KeyButton from "../menu/ui/KeyButton.svelte";
  import PlaceLine from "../menu/ui/PlaceLine.svelte";
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
  <section class="next-up" aria-label="Next up">
    <span class="next-up-mark" aria-hidden="true">
      {#if !ticket.place.here}
        <Icon name="icon-globe" />
      {:else}
        <svg viewBox="0 0 24 24" style:rotate={`${view.turn}deg`}><path d="M6 15l6-6 6 6" /></svg>
      {/if}
    </span>
    <div class="next-up-text">
      <span class="next-up-eyebrow">{ticket.eyebrow}</span>
      <b class="next-up-title">{ticket.title}</b>
      <PlaceLine place={ticket.place} tail={ticket.place.here ? (view.distance === null ? undefined : `${distance_text(view.distance)} ahead`) : "another map"} />
    </div>
    {#if !ticket.place.here}
      <span class="next-up-travel" bind:this={travel_box}>
        <KeyButton class="next-up-go" variant="quiet" hold={TRAVEL_HOLD_MS} onheld={travel} keys={{ key: "Hold Tab", pad: pad_label(TRAVEL_BUTTON), touch: "icon-globe" }}>Travel</KeyButton>
      </span>
    {/if}
  </section>
{/if}

<style>
  .next-up {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    max-width: min(26rem, 100%);
    padding: var(--gap-md) var(--pad) var(--gap-md) var(--gap-md);
    border: 1px solid var(--line-strong);
    border-radius: var(--card-radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--foreground);
    pointer-events: auto;
  }

  .next-up-mark {
    --icon-size: 1.3em;
    display: grid;
    flex: none;
    place-items: center;
    width: var(--top-h);
    height: var(--top-h);
    border-radius: 50%;
    background: var(--primary);
    color: var(--background-darkest);
    font-size: var(--type-body);
  }

  .next-up-mark svg:not(:global(.ui-icon)) {
    width: 1.5em;
    height: 1.5em;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: rotate 120ms linear;
  }

  .next-up-text {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .next-up-eyebrow {
    overflow: hidden;
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .next-up-title {
    overflow: hidden;
    font-size: var(--type-h3);
    font-weight: 800;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .next-up-travel {
    display: contents;
  }

  :global(:root .next-up-go) {
    --key-pad: var(--gap-md);
    --key-pad-cap: var(--gap-sm);
    height: var(--chip-h);
    margin-left: var(--gap-sm);
    font-size: var(--type-small);
  }

  /* A phone's top corners hold restart and pause, its top centre the lap: the ticket sits under the left pair, clear of the road. */
  @media (pointer: coarse) {
    :global(.next-up-dock) {
      position: fixed;
      top: calc(var(--inset-top) + var(--control-h) + var(--gap-sm));
      left: var(--inset-left);
      max-width: 46vw;
      pointer-events: none;
    }

    .next-up {
      pointer-events: none;
    }

    .next-up-travel > :global(*) {
      pointer-events: auto;
    }
  }
</style>
