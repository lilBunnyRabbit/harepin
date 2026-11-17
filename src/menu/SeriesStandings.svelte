<script lang="ts">
  import type { Standing } from "../career/series";

  interface Props {
    table: readonly Standing[];
  }

  let { table }: Props = $props();
</script>

<ol class="ss" aria-label="Standings">
  {#each table as row, i (row.driver)}
    <li data-you={row.you} data-rival={row.rival}>
      <span class="ss-pos">{i + 1}</span>
      <span class="ss-who">{row.you ? "You" : row.name}</span>
      <b>{row.points}</b>
    </li>
  {/each}
</ol>

<style>
  .ss {
    display: grid;
    grid-auto-rows: 1fr;
    gap: var(--gap-xs);
    min-height: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 1.4em minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--gap-sm);
    padding: 0 var(--gap-sm);
    border-radius: var(--radius-md);
    font-weight: 600;
    white-space: nowrap;
  }

  .ss-pos {
    color: var(--dim);
  }

  .ss-who {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  li[data-you="true"] {
    background: var(--primary);
    color: var(--on-primary);
  }

  li[data-you="true"] .ss-pos {
    color: inherit;
  }

  li[data-rival="true"] {
    box-shadow: inset 0 0 0 2px var(--warning);
  }

  li[data-rival="true"] .ss-who {
    color: var(--warning);
  }
</style>
