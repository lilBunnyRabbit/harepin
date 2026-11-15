<script lang="ts">
  import type { Standing } from "../career/series";
  import { driver_code } from "./series-view";

  interface Props {
    table: readonly Standing[];
    shape: "tower" | "row";
  }

  let { table, shape }: Props = $props();
</script>

<ol class="ss" data-shape={shape} aria-label="Standings">
  {#each table as row, i (row.driver)}
    <li data-you={row.you} data-rival={row.rival}>
      <span class="ss-pos">{i + 1}</span>
      <span class="ss-who">{shape === "tower" ? driver_code(row) : row.name}</span>
      <b>{row.points}</b>
    </li>
  {/each}
</ol>

<style>
  .ss {
    display: flex;
    gap: var(--space-1);
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ss[data-shape="tower"] {
    flex-direction: column;
    padding: var(--space-2);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .ss[data-shape="row"] {
    overflow-x: auto;
    scrollbar-width: none;
  }

  li {
    display: grid;
    grid-template-columns: 1.4em minmax(0, 1fr) auto;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font-weight: 600;
    white-space: nowrap;
  }

  [data-shape="tower"] li {
    height: var(--control-h-sm);
  }

  [data-shape="row"] li {
    height: var(--control-h-sm);
    padding: 0 var(--space-3);
    border-color: var(--set-line);
    border-radius: var(--radius-full);
    background: var(--set-panel);
  }

  .ss-pos {
    color: var(--set-dim);
  }

  li[data-you="true"] {
    border-color: var(--primary);
  }

  [data-shape="tower"] li[data-you="true"] {
    background: var(--primary);
    color: var(--on-primary);
  }

  [data-shape="tower"] li[data-you="true"] .ss-pos {
    color: inherit;
  }

  li[data-rival="true"] {
    border-color: var(--warning);
  }

  li[data-rival="true"] .ss-who {
    color: var(--warning);
  }
</style>
