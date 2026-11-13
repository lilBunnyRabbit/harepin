<script lang="ts">
  import { daily, type_of } from "../../runs/runs";
  import Badge from "../ui/Badge.svelte";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import Row from "../ui/Row.svelte";
  import RowList from "../ui/RowList.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import { daily_text, pick_text } from "../runs/run-text";

  let { menu, live }: Omit<PageProps, "shown"> = $props();

  const rows = $derived(live.live(() => menu.host.daily_board()));
  const today = $derived(live.live(() => menu.host.runs.today));
  const played = $derived(live.live(() => menu.host.runs.own_daily !== null));
  const pick = $derived(daily(today));
  const mode = $derived(type_of(pick.type).mode);
  const note = $derived(
    played ? "Times from players in this room and the ones seen here earlier today." : "Run today's daily and players in this room see your time; theirs show here.",
  );
</script>

<Card class="daily-board" label="Daily board">
  <SectionHead eyebrow="Daily board" title={pick_text(pick)} count={rows.length || undefined} />
  <p class="board-note">{note}</p>
  {#if rows.length}
    <div class="board-well">
      <RowList divided label="Today's daily times">
        {#each rows as row, i (`${row.you}:${row.name}`)}
          <Row label={`${i + 1}. ${row.name}`} help={row.you ? undefined : row.here ? "In this room" : "Seen earlier today"}>
            {#snippet control()}
              <span class="board-end">
                {#if row.you}<Badge tone="primary">You</Badge>{/if}
                <b class="board-time">{daily_text(mode, row)}</b>
              </span>
            {/snippet}
          </Row>
        {/each}
      </RowList>
    </div>
  {:else}
    <p class="board-empty">No times yet today.</p>
  {/if}
  <div class="board-go"><Button size="sm" onclick={() => menu.host.start_run(pick.id)}>Run today's daily</Button></div>
</Card>

<style>
  .board-note,
  .board-empty {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }

  .board-well {
    border-radius: var(--radius-md);
    background: var(--set-soft);
  }

  .board-end {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .board-go {
    display: flex;
  }

  .board-time {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
</style>
