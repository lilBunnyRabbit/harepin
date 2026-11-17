<script lang="ts">
  import { daily, type_of } from "../../runs/runs";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import { daily_text } from "./run-text";

  const TOP = 3;

  let { menu, live }: Omit<PageProps, "shown"> = $props();

  const board = $derived(live.live(() => menu.host.daily_board()));
  const today = $derived(live.live(() => menu.host.runs.today));
  const mode = $derived(type_of(daily(today).type).mode);
  const ranked = $derived(board.rows.map((row, at) => ({ ...row, place: at + 1 })));
  // Past the top times the player's own still shows, in its place.
  const rows = $derived(ranked.filter((row) => row.place <= TOP || row.you));
</script>

<span class="daily-board" role="group" aria-label="Today's times">
  {#each rows as row (`${row.you}:${row.name}`)}
    <span class="daily-row" data-you={row.you ? "" : undefined}>
      <span class="daily-place">{row.place}</span>
      <span class="daily-name">{row.name}{row.you ? " · you" : ""}</span>
      <b class="daily-time">{daily_text(mode, row)}</b>
    </span>
  {:else}
    <span class="daily-note">No times yet today. Yours shows to players in your room.</span>
  {/each}
  {#if board.hidden}<span class="daily-note">{board.hidden} from other versions hidden</span>{/if}
</span>

<style>
  .daily-board {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
    padding-top: var(--gap-sm);
    border-top: 1px solid var(--line);
    font-size: var(--type-small);
  }

  .daily-row {
    display: grid;
    grid-template-columns: 1.5em minmax(0, 1fr) auto;
    align-items: baseline;
    gap: var(--gap-sm);
  }

  .daily-place,
  .daily-note {
    color: var(--dim);
  }

  .daily-place,
  .daily-time {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .daily-name {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [data-you] > .daily-name {
    font-weight: 800;
  }

  .daily-note {
    text-wrap: pretty;
  }

  @media (max-height: 500px) {
    .daily-row:nth-child(n + 2):not([data-you]) {
      display: none;
    }
  }
</style>
