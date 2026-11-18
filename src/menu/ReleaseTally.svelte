<script lang="ts">
  import type { Release } from "../changelog";
  import { tally } from "./release-days";

  interface Props {
    release: Release;
  }

  let { release }: Props = $props();
</script>

<span class="tally">
  {#each tally(release) as { kind, count } (kind)}
    <span class="tally-kind" data-kind={kind}>{count} {kind}</span>
  {/each}
</span>

<style>
  .tally {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--space-0) var(--gap-sm);
    color: var(--dim);
    font-size: var(--type-eyebrow);
    white-space: nowrap;
  }

  .tally-kind::before {
    content: "";
    display: inline-block;
    width: 0.5em;
    height: 0.5em;
    margin-right: 0.35em;
    border-radius: var(--radius-full);
    background: currentColor;
    vertical-align: 0.05em;
  }

  [data-kind="new"]::before {
    color: var(--success);
  }

  [data-kind="improved"]::before {
    color: var(--info);
  }

  [data-kind="fixed"]::before {
    color: var(--warning);
  }
</style>
