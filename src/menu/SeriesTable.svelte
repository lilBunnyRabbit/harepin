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
    margin: 0 0 var(--gap-md);
    font-size: var(--type-body);
  }

  .sr-standings {
    display: grid;
    gap: var(--gap-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sr-standings li {
    display: grid;
    grid-template-columns: 1.5em minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--gap-sm);
    padding: var(--gap-xs) var(--gap-sm);
    border-radius: var(--radius-sm);
  }

  .sr-standings li[data-now="true"] {
    background: var(--row);
  }

  .sr-who {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    min-width: 0;
  }

  .sr-dim {
    color: var(--dim);
  }

  .sr-lines {
    display: grid;
    gap: var(--gap-xs);
    margin: var(--gap) 0 0;
    padding: 0;
    list-style: none;
    color: var(--dim);
    font-size: var(--type-small);
  }
</style>
