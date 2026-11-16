<script lang="ts">
  import KeyButton from "../menu/ui/KeyButton.svelte";
  import PlaceChip from "../menu/ui/PlaceChip.svelte";
  import Ticket from "../menu/ui/Ticket.svelte";
  import type { ResultNextView } from "./result-next.svelte";

  interface Props {
    next: ResultNextView;
  }

  let { next }: Props = $props();

  let root: HTMLElement | undefined = $state();

  const picture = $derived(next.ticket ? `${import.meta.env.BASE_URL}menu/${next.ticket.kind}.webp` : null);

  // Capture, ahead of the chat's Enter and the menu's Escape: while the card waits, both answer it.
  function key(event: KeyboardEvent) {
    const card = root?.closest<HTMLElement>("#mode-result");
    if (event.repeat || !card || card.hidden) return;
    const at = document.activeElement;
    const free = !at || at === document.body;
    if (!free && !card.contains(at)) return;
    if (event.code === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      next.leave();
    } else if ((event.code === "Enter" || event.code === "NumpadEnter") && free && next.shown && !next.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      next.go();
    }
  }
</script>

<svelte:window onkeydowncapture={key} />

<div class="result-next" bind:this={root}>
  {#if next.shown}
    <div class="result-next-card" data-ticket={next.ticket ? "" : undefined}>
      {#if next.ticket}
        <img class="result-next-pic" src={picture} alt="" />
        <Ticket tier={next.ticket.tier} eyebrow={next.ticket.eyebrow} title={next.ticket.title} reasons={[{ text: next.ticket.mode }]} place={place_chip} />
      {/if}
      <KeyButton class="result-next-go" keys={{ key: "Enter", touch: "icon-play" }} size="lg" disabled={next.disabled} onclick={() => next.go()}>{next.label}</KeyButton>
    </div>
  {/if}
  <KeyButton class="result-leave" variant="quiet" keys={{ key: "Esc" }} onclick={() => next.leave()}>Keep driving here</KeyButton>
</div>

{#snippet place_chip()}
  {#if next.ticket}<PlaceChip place={next.ticket.place} />{/if}
{/snippet}

<style>
  .result-next {
    display: contents;
  }

  .result-next-card {
    grid-area: next;
    display: grid;
    gap: var(--space-3);
    align-self: end;
    min-width: 0;
    pointer-events: auto;
  }

  .result-next-card[data-ticket] {
    grid-template-columns: calc(var(--space-8) * 4) minmax(0, 1fr);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: 0 0 0 var(--space-0) var(--cottontail);
  }

  .result-next-pic {
    width: 100%;
    height: 100%;
    min-height: 0;
    object-fit: cover;
    border-radius: var(--radius-md);
  }

  .result-next-card :global(.result-next-go) {
    grid-column: 1 / -1;
    justify-content: center;
    width: 100%;
  }

  .result-next :global(.result-leave) {
    grid-area: leave;
    justify-self: center;
    pointer-events: auto;
  }

  @media (max-height: 500px) {
    .result-next-card {
      align-self: start;
    }

    .result-next-card[data-ticket] {
      grid-template-columns: calc(var(--space-8) * 3) minmax(0, 1fr);
      gap: var(--space-2);
      padding: var(--space-2);
    }

    .result-next-card :global(.ui-ticket-reasons) {
      display: none;
    }

    .result-next-card :global(.result-next-go) {
      height: var(--control-h-lg);
      font-size: var(--text-xl);
    }

    /* Beside the retry icons: the right column stays clear of the pedals. */
    .result-next :global(.result-leave) {
      grid-area: facts;
      justify-self: end;
      align-self: end;
    }
  }
</style>
