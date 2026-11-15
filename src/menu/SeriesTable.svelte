<script lang="ts">
  import { event_line, type Season, type SeriesProgress, type Standing } from "../career/series";
  import Badge from "./ui/Badge.svelte";
  import Card from "./ui/Card.svelte";

  interface Props {
    season: Season;
    progress: SeriesProgress;
    rows: readonly Standing[];
  }

  let { season, progress, rows }: Props = $props();

  const lines = $derived(season.events.flatMap((event) => (progress.results[event.id] ? [event_line(season, event, progress.results[event.id])] : [])));
</script>

<Card label="Standings">
  <h4>Standings</h4>
  <ol class="sr-standings">
    {#each rows as row, i (row.driver)}
      <li data-now={row.you}>
        <span class="sr-dim">{i + 1}</span>
        <span class="sr-who">{row.name}{#if row.rival}<Badge tone="warning">Rival</Badge>{/if}</span>
        <b>{row.points}</b>
      </li>
    {/each}
  </ol>
  {#if lines.length}
    <ul class="sr-lines">
      {#each lines as text (text)}<li>{text}</li>{/each}
    </ul>
  {/if}
</Card>

<style>
  h4 {
    margin: 0 0 var(--space-3);
    font-size: var(--text-lg);
  }

  .sr-standings {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sr-standings li {
    display: grid;
    grid-template-columns: 1.5em minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }

  .sr-standings li[data-now="true"] {
    background: var(--set-well);
  }

  .sr-who {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .sr-dim {
    color: var(--set-dim);
  }

  .sr-lines {
    display: grid;
    gap: var(--space-1);
    margin: var(--space-4) 0 0;
    padding: 0;
    list-style: none;
    color: var(--set-dim);
    font-size: var(--text-sm);
  }
</style>
