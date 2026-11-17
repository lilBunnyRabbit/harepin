<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import Card from "../menu/ui/Card.svelte";
  import KeyLink from "../menu/ui/KeyLink.svelte";
  import PageFrame from "../menu/ui/PageFrame.svelte";
  import PlaceLine from "../menu/ui/PlaceLine.svelte";
  import PrimaryAction from "../menu/ui/PrimaryAction.svelte";
  import type { ResultNextView } from "./result-next.svelte";
  import { MAX_STARS } from "./track";

  const VEIL = 0.62;
  const PLACE = /^(\d+)(\D+)$/;

  interface Props {
    view: ResultNextView;
  }

  let { view }: Props = $props();

  let root: HTMLElement | undefined = $state();

  const card = $derived(view.card);
  const ticket = $derived(view.shown ? view.ticket : null);
  const map_src = $derived(ticket ? `${import.meta.env.BASE_URL}menu/${ticket.kind}.webp` : null);
  const place = $derived(card?.placed ? PLACE.exec(card.stamp) : null);

  const rows = (list: readonly HTMLElement[]): Attachment<HTMLElement> => (node) => node.replaceChildren(...list);

  // Enter reaches Next as a focused button: the chat's Enter skips one.
  const take_focus: Attachment<HTMLElement> = (node) => {
    if (view.disabled || document.activeElement !== document.body || document.documentElement.dataset.input === "touch") return;
    node.querySelector<HTMLElement>(".ui-primary")?.focus({ preventScroll: true, focusVisible: false });
  };

  // Capture, ahead of the menu's Escape: while the card waits, Escape keeps driving.
  function key(event: KeyboardEvent) {
    const page = root?.closest<HTMLElement>("#mode-result");
    if (event.code !== "Escape" || event.repeat || !page || page.hidden) return;
    const at = document.activeElement;
    if (at && at !== document.body && !page.contains(at)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    view.host.leave();
  }
</script>

<svelte:window onkeydowncapture={key} />

{#snippet links()}
  <KeyLink keys={{ key: "R", pad: "Y", touch: "icon-restart" }} onclick={() => view.host.retry()}>Restart</KeyLink>
  {#if card?.can_change_car}<KeyLink keys={{ touch: "icon-car" }} onclick={() => view.host.change_car()}>Change car</KeyLink>{/if}
  {#if card?.can_try}<KeyLink keys={{ touch: "icon-paint" }} onclick={() => view.host.try_on()}>Try it in the garage</KeyLink>{/if}
{/snippet}

{#snippet primary()}
  {#if view.shown}
    <PrimaryAction disabled={view.disabled} onclick={() => view.go()}>{view.label}</PrimaryAction>
  {/if}
{/snippet}

{#snippet facts()}
  <div class="result-facts" {@attach rows(card?.lines ?? [])}></div>
{/snippet}

<div class="result-page" bind:this={root}>
  {#if card}
    {#key view.opened}
      <div class="result-frame" {@attach take_focus}>
        <PageFrame veil={VEIL} eyebrow={card.eyebrow} title={card.title} back={{ to: "Road", go: () => view.host.leave() }} {links} note={view.note} {primary}>
          <div class="result-cards" data-count={ticket ? 3 : 2}>
            <Card class="result-stamp-card" label="Result">
              <div class="result-stamp">
                {#if place}
                  <span class="result-place">{place[1]}<sup>{place[2]}</sup></span>
                {:else}
                  <span class="result-headline">{card.stamp}</span>
                {/if}
                <span class="result-stars" role="img" aria-label={`${card.stars} of ${MAX_STARS} stars`}>
                  <b>{"★".repeat(card.stars)}</b>{"★".repeat(MAX_STARS - card.stars)}
                </span>
              </div>
              {#if card.unlock.length}<div class="result-unlock" {@attach rows(card.unlock)}></div>{/if}
              {#if card.table}{@render facts()}{/if}
            </Card>
            {#if card.table}
              <Card class="result-table-card" label={card.table.title}>
                <b class="result-h3">{card.table.title}</b>
                <ol class="result-table" {@attach rows(card.table.rows)}></ol>
              </Card>
            {:else}
              <Card class="result-run-card" label="Your run">
                <b class="result-h3">Your run</b>
                {@render facts()}
              </Card>
            {/if}
            {#if ticket}
              <Card class="result-next-card" focused wide onclick={() => view.go()} label={`Next: ${ticket.title}`}>
                {#snippet picture()}<img src={map_src} alt="" />{/snippet}
                <span class="result-eyebrow">{ticket.eyebrow}</span>
                <b class="result-h2">{ticket.title}</b>
                <PlaceLine place={ticket.place} tail={ticket.mode} />
              </Card>
            {/if}
          </div>
        </PageFrame>
      </div>
    {/key}
  {/if}
</div>

<style>
  .result-page,
  .result-frame {
    display: contents;
  }

  .result-cards {
    display: grid;
    grid-template-columns: 0.9fr 1.15fr 1fr;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .result-cards[data-count="2"] {
    grid-template-columns: 0.9fr 1.15fr;
  }

  .result-cards > :global(.result-stamp-card) {
    justify-content: space-between;
  }

  .result-stamp {
    display: grid;
    justify-items: start;
    gap: var(--gap-sm);
    min-width: 0;
  }

  .result-place {
    color: var(--cottontail);
    font-size: var(--display-4);
    font-weight: 800;
    line-height: 0.9;
  }

  .result-place sup {
    margin-left: 0.05em;
    font-size: 0.36em;
    vertical-align: 1.05em;
  }

  .result-headline {
    color: var(--cottontail);
    font-size: var(--display-1);
    font-weight: 800;
    line-height: 1;
    text-wrap: balance;
  }

  .result-stars {
    color: var(--line-strong);
    font-size: var(--type-h1);
    line-height: 1;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .result-stars b {
    color: var(--accent);
    font-weight: inherit;
  }

  .result-h2,
  .result-h3 {
    font-weight: 800;
    line-height: 1.15;
  }

  .result-h2 {
    font-size: var(--type-h2);
  }

  .result-h3 {
    font-size: var(--type-h3);
  }

  .result-eyebrow,
  .result-facts > :global(div > span) {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .result-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--gap-sm);
    min-height: 0;
  }

  .result-facts > :global(div) {
    display: grid;
    align-content: center;
    gap: var(--gap-xs);
    min-width: 0;
    padding: var(--gap-md) var(--gap);
    border-radius: var(--radius-md);
    background: var(--row);
  }

  .result-facts > :global(div > b) {
    font-family: var(--font-mono);
    font-size: var(--type-h2);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
    text-wrap: balance;
  }

  /* An odd fact out takes the full row, so the grid never ends on a hole. */
  .result-facts > :global(div:last-child:nth-child(odd)) {
    grid-column: 1 / -1;
  }

  .result-cards > :global(.result-run-card > .result-facts) {
    flex: 1;
    grid-auto-rows: minmax(0, 1fr);
  }

  .result-table {
    display: grid;
    flex: 1;
    grid-template-columns: 1.6em minmax(0, 1fr) auto auto;
    grid-auto-rows: minmax(0, 1fr);
    gap: var(--gap-xs) var(--gap-sm);
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    font-variant-numeric: tabular-nums;
    scrollbar-width: none;
  }

  .result-table > :global(li) {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    min-height: var(--row-h);
    padding: 0 var(--gap-md);
    border-radius: var(--radius-md);
    white-space: nowrap;
  }

  .result-table > :global(li > span:nth-child(2)) {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-table > :global(li[data-now="true"]) {
    background: var(--row-on);
    color: var(--primary);
  }

  .result-table > :global(li > b) {
    font-family: var(--font-mono);
    font-weight: 700;
    text-align: right;
  }

  .result-table > :global(li > .dim) {
    color: var(--dim);
  }

  .result-table > :global(.cup-total) {
    border-top: 1px solid var(--line-strong);
    border-radius: 0;
  }

  .result-table > :global(.cup-total > span) {
    grid-column: 1 / 3;
  }

  .result-unlock {
    display: grid;
    min-width: 0;
  }

  @media (max-height: 500px) {
    .result-cards {
      grid-template-columns: 0.9fr 1.15fr 0.8fr;
    }

    .result-cards > :global(.result-next-card) {
      flex-direction: column;
    }

    .result-cards > :global(.result-next-card > .ui-card-pic) {
      flex: 1;
    }

    .result-cards > :global(.result-next-card > .ui-card-cap) {
      flex: none;
    }

    .result-facts > :global(div) {
      padding: var(--gap-sm) var(--gap-md);
    }

    .result-table > :global(li) {
      min-height: 0;
    }
  }
</style>
