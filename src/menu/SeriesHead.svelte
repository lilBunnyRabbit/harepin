<script lang="ts">
  import type { Snippet } from "svelte";
  import { ordinal, type Season, type SeriesProgress, type Standing } from "../career/series";
  import { credits_text } from "../career/wallet";
  import { duel_text, rival_gap } from "./series-view";

  interface Props {
    season: Season;
    progress: SeriesProgress;
    table: readonly Standing[];
    credits: number;
    /** Stands in for the season's name, as the season switcher does. */
    title?: Snippet;
    children?: Snippet;
  }

  let { season, progress, table, credits, title, children }: Props = $props();

  const ran = $derived(season.events.filter((event) => progress.results[event.id]).length);
  const rank = $derived(table.findIndex((row) => row.you) + 1);
  const me = $derived(table.find((row) => row.you));
  const duel = $derived(rival_gap(season, table));
</script>

<header class="sh">
  <div class="sh-title">
    {#if title}{@render title()}{:else}<h2>{season.name} series</h2>{/if}
    {#if children}<p class="sh-terms">{@render children()}</p>{/if}
  </div>
  <dl class="sh-stats" aria-label="Your season">
    <div>
      <dt>Place</dt>
      <dd>{ran ? ordinal(rank) : "–"}</dd>
    </div>
    <div>
      <dt>Points</dt>
      <dd>{me?.points ?? 0}</dd>
    </div>
    {#if duel}
      <div class="sh-rival">
        <dt>Rival {duel.rival.name}</dt>
        <dd>{duel_text(duel.gap)}</dd>
      </div>
    {/if}
    <div>
      <dt>Credits</dt>
      <dd>{credits_text(credits)}</dd>
    </div>
  </dl>
</header>

<style>
  .sh {
    position: relative;
    z-index: 200;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    justify-self: center;
    align-items: start;
    gap: var(--space-6);
    width: min(100%, 80rem);
  }

  /* The title sits straight on the live sky, which can be as light as the dim text. */
  .sh-title {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
    text-shadow:
      0 0 2px var(--background-darkest),
      0 1px 12px var(--background-darkest);
  }

  h2 {
    margin: 0;
    font-size: var(--text-3xl);
    font-weight: 800;
    line-height: 1.05;
    white-space: nowrap;
  }

  .sh-terms {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-md);
    font-weight: 600;
  }

  .sh-stats {
    display: flex;
    margin: 0;
    padding: var(--space-2) 0;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .sh-stats div {
    display: grid;
    gap: var(--space-0);
    padding: 0 var(--space-4);
  }

  .sh-stats div + div {
    border-left: 1px solid var(--set-line);
  }

  dt {
    color: var(--set-dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  dd {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 800;
    white-space: nowrap;
  }

  .sh-rival dt {
    color: var(--warning);
  }

  @media (max-height: 500px) {
    .sh {
      gap: var(--space-4);
    }

    h2 {
      font-size: var(--text-xl);
    }

    .sh-terms {
      display: none;
    }

    .sh-stats {
      padding: var(--space-1) 0;
    }

    .sh-stats div {
      padding: 0 var(--space-3);
    }

    dt {
      font-size: var(--text-2xs);
    }

    dd {
      font-size: var(--text-lg);
    }
  }
</style>
