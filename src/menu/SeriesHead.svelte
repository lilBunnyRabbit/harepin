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
    gap: calc(2 * var(--gap-md));
    width: min(100%, 80rem);
  }

  /* The title sits straight on the live sky, which can be as light as the dim text. */
  .sh-title {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
    text-shadow:
      0 0 2px var(--background-darkest),
      0 1px 12px var(--background-darkest);
  }

  h2 {
    margin: 0;
    font-size: var(--type-h1);
    font-weight: 800;
    line-height: 1.05;
    white-space: nowrap;
  }

  .sh-terms {
    margin: 0;
    color: var(--dim);
    font-size: var(--type-body);
    font-weight: 600;
  }

  .sh-stats {
    display: flex;
    margin: 0;
    padding: var(--gap-sm) 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .sh-stats div {
    display: grid;
    gap: var(--space-0);
    padding: 0 var(--gap);
  }

  .sh-stats div + div {
    border-left: 1px solid var(--line);
  }

  dt {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  dd {
    margin: 0;
    font-size: var(--type-h3);
    font-weight: 800;
    white-space: nowrap;
  }

  .sh-rival dt {
    color: var(--warning);
  }

  @media (max-height: 500px) {
    .sh-terms {
      display: none;
    }
  }

  /* Portrait: the numbers run the full width under the title. */
  @media (orientation: portrait) and (max-width: 700px) {
    .sh {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--gap-md);
    }

    .sh-stats div {
      flex: none;
      padding: 0 var(--gap-md);
    }

    .sh-stats .sh-rival {
      flex: 1 1 0;
      min-width: 0;
    }

    dt {
      overflow: hidden;
      font-size: var(--type-eyebrow);
      text-overflow: ellipsis;
    }
  }
</style>
