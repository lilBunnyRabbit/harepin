<script lang="ts">
  import type { Snippet } from "svelte";
  import BackPill from "./BackPill.svelte";

  interface Back {
    to: string;
    go: () => void;
  }

  interface Props {
    eyebrow?: string;
    title?: string;
    stations?: Snippet;
    chips?: Snippet;
    back?: Back;
    links?: Snippet;
    note?: string;
    primary?: Snippet;
    /** 0 to 1: how far the scene behind the frame dims, for a page of cards rather than a stage. */
    veil?: number;
    floor?: boolean;
    children: Snippet;
  }

  let { eyebrow, title, stations, chips, back, links, note, primary, veil = 0, floor = false, children }: Props = $props();
</script>

<div class="ui-frame">
  {#if veil > 0}<div class="ui-frame-veil" style:opacity={veil}></div>{/if}
  {#if floor}<div class="ui-frame-sky"></div><div class="ui-frame-floor"></div>{/if}
  <div class="ui-frame-rows">
    <header class="ui-frame-top">
      <div class="ui-frame-title">
        {#if title}
          {#if eyebrow}<span class="ui-frame-eyebrow">{eyebrow}</span>{/if}
          <h1>{title}</h1>
        {/if}
      </div>
      <div class="ui-frame-stations">{@render stations?.()}</div>
      <div class="ui-frame-chips">{@render chips?.()}</div>
    </header>
    <main class="ui-frame-body">{@render children()}</main>
    <footer class="ui-frame-bottom">
      <div class="ui-frame-links">
        {#if back}<BackPill to={back.to} onclick={back.go} />{/if}
        {@render links?.()}
      </div>
      <div class="ui-frame-action">
        {#if note}<span class="ui-frame-note">{note}</span>{/if}
        {@render primary?.()}
      </div>
    </footer>
  </div>
</div>

<style>
  /* One frame for every screen: top row, body, bottom row, the same edge all round. Past 1600 wide the rows stay in one
     centred column, so nothing pins to a far edge while the cards sit in the middle. */
  .ui-frame {
    position: absolute;
    inset: 0;
    display: grid;
    justify-items: center;
    color: var(--foreground);
    font-size: var(--type-body);
    font-weight: 500;
    line-height: 1.35;
    pointer-events: none;
  }

  .ui-frame-veil,
  .ui-frame-sky,
  .ui-frame-floor {
    position: absolute;
    inset: 0;
  }

  .ui-frame-veil {
    background: var(--background-darkest);
  }

  .ui-frame-sky {
    bottom: auto;
    height: 22%;
    background: linear-gradient(color-mix(in oklch, var(--background-darkest) 70%, transparent), transparent);
  }

  .ui-frame-floor {
    top: auto;
    height: 36%;
    background: linear-gradient(transparent, color-mix(in oklch, var(--background-darkest) 82%, transparent));
  }

  .ui-frame-rows {
    position: relative;
    display: grid;
    grid-template-rows: var(--top-h) minmax(0, 1fr) var(--primary-h);
    gap: var(--gap);
    width: 100%;
    max-width: 1600px;
    min-height: 0;
    padding: var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left);
  }

  .ui-frame-top {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--gap);
    min-width: 0;
  }

  .ui-frame-title {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
    line-height: 1.1;
  }

  .ui-frame-eyebrow {
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

  h1 {
    margin: 0;
    overflow: hidden;
    font-size: var(--type-h2);
    font-weight: 800;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ui-frame-stations,
  .ui-frame-chips,
  .ui-frame-links,
  .ui-frame-action {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .ui-frame-chips {
    justify-self: end;
    gap: var(--gap-sm);
  }

  .ui-frame-body {
    min-width: 0;
    min-height: 0;
  }

  .ui-frame-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap);
    min-width: 0;
  }

  .ui-frame-links,
  .ui-frame-action {
    gap: var(--gap);
  }

  .ui-frame-top > *,
  .ui-frame-body > :global(*),
  .ui-frame-links > :global(*),
  .ui-frame-action > :global(*) {
    pointer-events: auto;
  }

  .ui-frame-note {
    max-width: 30em;
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
    text-align: right;
    text-wrap: balance;
  }

  /* A phone body that runs long scrolls as one; the rows around it stay put. */
  @media (max-height: 500px) {
    .ui-frame-body {
      overflow-y: auto;
      scrollbar-width: none;
    }

    .ui-frame-links {
      gap: var(--gap-sm);
    }
  }
</style>
