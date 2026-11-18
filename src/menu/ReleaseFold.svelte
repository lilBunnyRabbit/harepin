<script lang="ts">
  import type { Release } from "../changelog";
  import ChangeList from "./ChangeList.svelte";
  import ReleaseTally from "./ReleaseTally.svelte";
  import Badge from "./ui/Badge.svelte";

  interface Props {
    release: Release;
    fresh?: boolean;
  }

  let { release, fresh = false }: Props = $props();
</script>

<details class="fold" data-fresh={fresh ? "" : undefined}>
  <summary class="fold-head">
    <span class="fold-text">
      <b class="fold-title">{release.title}</b>
      <span class="fold-meta"><span class="fold-version">v{release.version}</span><ReleaseTally {release} /></span>
    </span>
    {#if fresh}<Badge tone="primary">New</Badge>{/if}
    <span class="fold-chevron" aria-hidden="true"></span>
  </summary>
  <div class="fold-body"><ChangeList changes={release.changes} /></div>
</details>

<style>
  .fold {
    border-radius: var(--radius-md);
  }

  .fold[open] {
    background: var(--row);
  }

  .fold-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--gap-sm) var(--gap-md);
    min-height: var(--row-h);
    padding: var(--gap-sm) var(--gap-md);
    border-radius: var(--radius-md);
    list-style: none;
  }

  .fold-head::-webkit-details-marker {
    display: none;
  }

  .fold-head:hover {
    background: var(--row);
  }

  .fold-version {
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: var(--type-eyebrow);
  }

  .fold-text {
    display: grid;
    gap: var(--space-0);
    min-width: 0;
  }

  .fold-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-0) var(--gap-md);
  }

  .fold-title {
    font-weight: 600;
  }

  .fold-chevron {
    width: 0.5em;
    height: 0.5em;
    border-right: 2px solid var(--dim);
    border-bottom: 2px solid var(--dim);
    transform: translateY(-25%) rotate(45deg);
  }

  .fold[open] .fold-chevron {
    transform: translateY(25%) rotate(-135deg);
  }

  .fold-body {
    padding: 0 var(--gap-md) var(--gap-md);
  }
</style>
