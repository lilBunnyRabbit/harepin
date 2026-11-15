<script lang="ts">
  import { KIND_NAMES, KIND_RULES, ordinal, place_of, player_of, result_points, type EventState, type Season, type SeriesProgress } from "../career/series";
  import Badge from "./ui/Badge.svelte";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";

  interface Props {
    season: Season;
    progress: SeriesProgress;
    states: readonly EventState[];
    onstart: (id: string) => void;
  }

  let { season, progress, states, onstart }: Props = $props();

  const player = $derived(player_of(season));
  const first_open = $derived(states.findIndex((state) => state === "open"));
</script>

<ol class="sr-list">
  {#each season.events as event, i (event.id)}
    {@const state = states[i]}
    {@const result = progress.results[event.id]}
    <li>
      <Card variant={state === "locked" ? "well" : "panel"} class="sr-event" label={event.name}>
        <div class="sr-row">
          <span class="sr-n">{i + 1}</span>
          <div class="sr-text">
            <div class="sr-name">
              <b>{event.name}</b>
              <Badge tone={event.final ? "accent" : "neutral"}>{event.final ? "Final" : KIND_NAMES[event.kind]}</Badge>
            </div>
            <span class="sr-dim">{KIND_RULES[event.kind]}</span>
            {#if result}
              <span class="sr-result" data-podium={state === "podium"}>{ordinal(place_of(result, player))} · {result_points(season, event, result, player)} pts</span>
            {/if}
          </div>
          {#if state === "locked"}
            <span class="sr-dim sr-lock">{event.final ? "Podium every event" : "Podium to open"}</span>
          {:else}
            <Button variant={i === first_open ? "primary" : "secondary"} size="sm" onclick={() => onstart(event.id)}>{result ? "Race again" : "Race"}</Button>
          {/if}
        </div>
      </Card>
    </li>
  {/each}
</ol>

<style>
  .sr-list {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sr-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .sr-n {
    flex: none;
    width: 1.5em;
    color: var(--set-dim);
    font-size: var(--text-xl);
    text-align: center;
  }

  .sr-text {
    display: grid;
    flex: 1;
    min-width: 0;
    gap: var(--space-1);
  }

  .sr-name {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .sr-dim {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .sr-result {
    font-size: var(--text-sm);
  }

  .sr-result[data-podium="true"] {
    color: var(--success);
  }

  .sr-lock {
    flex: none;
    text-align: end;
  }
</style>
