<script lang="ts">
  import { event_states, season_done, standings, type SeriesProgress } from "../career/series";
  import SeriesEvents from "./SeriesEvents.svelte";
  import SeriesTable from "./SeriesTable.svelte";
  import Button from "./ui/Button.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  let { menu, live }: PageProps = $props();

  const series = $derived(menu.host.series);
  const progress = $derived<SeriesProgress | null>(live.live(() => (menu.host.series?.ready ? menu.host.series.progress : null)));
  const season = $derived(series?.season ?? null);
  const table = $derived(season && progress ? standings(season, progress) : []);
  const states = $derived(season && progress ? event_states(season, progress) : []);
  const done = $derived(season && progress ? season_done(season, progress) : false);
  const rank = $derived(table.findIndex((row) => row.you) + 1);

  function reset() {
    series?.reset();
    menu.refresh();
  }
</script>

{#if season && progress}
  <div class="sr-page">
    <header class="sr-head">
      <p class="sr-eyebrow">Series {season.id.slice(1)} · {season.name}</p>
      <h3>{done ? `Series complete: ${table[0].you ? "you are champion" : `${table[0].name} takes the title`}` : Object.keys(progress.results).length ? `You are ${rank} of ${table.length}` : `${season.events.length} events against ${season.field.length} drivers`}</h3>
      <p class="sr-dim">A podium opens the next event; the final opens once every other event has one. Points by place, plus bonus objectives.</p>
    </header>

    <section class="sr-events" aria-label="Events">
      <SeriesEvents {season} {progress} {states} onstart={(id) => menu.host.start_series(id)} />
    </section>

    <aside class="sr-table" aria-label="Standings">
      <SeriesTable {season} {progress} rows={table} />
      <div><Button variant="quiet" size="sm" onclick={reset}>Start the series over</Button></div>
    </aside>
  </div>
{/if}

<style>
  .sr-page {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 22rem;
    grid-template-areas: "head head" "events table";
    align-items: start;
    gap: var(--space-6) var(--space-8);
  }

  .sr-head {
    grid-area: head;
    display: grid;
    gap: var(--space-1);
  }

  .sr-eyebrow,
  .sr-dim {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  h3 {
    margin: 0;
    font-size: var(--text-2xl);
  }

  .sr-events {
    grid-area: events;
    min-width: 0;
  }

  .sr-table {
    grid-area: table;
    display: grid;
    gap: var(--space-3);
  }

  @media (max-width: 1000px), (max-height: 500px) {
    .sr-page {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: "head" "events" "table";
      gap: var(--space-4);
    }
  }
</style>
