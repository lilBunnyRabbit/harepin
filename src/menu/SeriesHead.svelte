<script lang="ts">
  import type { Snippet } from "svelte";
  import { ordinal, type Season, type SeriesProgress, type Standing } from "../career/series";
  import { credits_text } from "../career/wallet";
  import SeriesBack from "./SeriesBack.svelte";
  import { duel_line, rival_gap } from "./series-view";

  interface Props {
    season: Season;
    progress: SeriesProgress;
    table: readonly Standing[];
    credits: number;
    onback: () => void;
    children?: Snippet;
  }

  let { season, progress, table, credits, onback, children }: Props = $props();

  const ran = $derived(season.events.filter((event) => progress.results[event.id]).length);
  const rank = $derived(table.findIndex((row) => row.you) + 1);
  const me = $derived(table.find((row) => row.you));
  const duel = $derived(rival_gap(season, table));
</script>

<header class="sh">
  <SeriesBack {onback} />
  <div class="sh-title">
    <h2>{season.name} series</h2>
    {@render children?.()}
  </div>
  <div class="sh-me">
    <b>{ran ? ordinal(rank) : "–"}</b>
    <span>{me?.points ?? 0} pts</span>
    {#if duel}<span class="sh-rival">{duel_line(duel.rival, duel.gap)}</span>{/if}
  </div>
  <div class="sh-me sh-cr" aria-label="Credits">
    <b>{credits_text(credits)}</b>
  </div>
</header>

<style>
  .sh {
    position: relative;
    z-index: 200;
    display: flex;
    justify-self: center;
    width: min(100%, 80rem);
    align-items: center;
    gap: var(--space-4);
    min-width: 0;
  }

  .sh-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
    min-width: 0;
    margin-right: auto;
  }

  h2 {
    margin: 0;
    font-size: var(--text-3xl);
    font-weight: 800;
    line-height: 1.05;
    white-space: nowrap;
  }

  .sh-me {
    display: flex;
    flex: none;
    align-items: baseline;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--surface);
    white-space: nowrap;
  }

  .sh-me b {
    font-size: var(--text-xl);
  }

  .sh-cr b {
    color: var(--warning);
  }

  .sh-rival {
    color: var(--warning);
    font-weight: 600;
  }

  @media (max-height: 500px) {
    h2 {
      font-size: var(--text-xl);
    }

    .sh-me {
      padding: var(--space-1) var(--space-3);
    }
  }
</style>
