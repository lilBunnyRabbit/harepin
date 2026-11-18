<script lang="ts">
  import type { Change } from "../changelog";
  import KindBadge from "./KindBadge.svelte";

  interface Props {
    changes: readonly Change[];
  }

  let { changes }: Props = $props();
</script>

<ul class="changes">
  {#each changes as change, index (index)}
    <li>
      <span class="changes-kind"><KindBadge kind={change.kind} /></span>
      <span>{change.text}</span>
    </li>
  {/each}
</ul>

<style>
  .changes {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--gap-md);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: baseline;
    gap: var(--gap-md);
    line-height: 1.45;
    text-wrap: pretty;
  }

  .changes-kind {
    display: flex;
  }

  @media (max-width: 600px) {
    .changes {
      grid-template-columns: minmax(0, 1fr);
    }

    li {
      gap: var(--gap-xs);
    }
  }
</style>
