<script lang="ts">
  import { ChangeKind, type Release } from "../changelog";
  import Badge from "./ui/Badge.svelte";

  interface Props {
    release: Release;
    fresh?: boolean;
  }

  let { release, fresh = false }: Props = $props();

  const KINDS = {
    [ChangeKind.NEW]: { label: "New", tone: "success" },
    [ChangeKind.IMPROVED]: { label: "Improved", tone: "info" },
    [ChangeKind.FIXED]: { label: "Fixed", tone: "neutral" },
  } as const;
</script>

<section class="release">
  <p class="release-line">
    <b class="release-version">v{release.version}</b>
    <span class="release-title">{release.title}</span>
    {#if fresh}<Badge tone="primary">New</Badge>{/if}
    <time class="release-date" datetime={release.date}>{release.date}</time>
  </p>
  <ul class="release-changes">
    {#each release.changes as change, index (index)}
      <li>
        <span class="release-kind"><Badge tone={KINDS[change.kind].tone}>{KINDS[change.kind].label}</Badge></span>
        <span>{change.text}</span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .release {
    display: grid;
    gap: var(--space-3);
  }

  .release-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
    margin: 0;
  }

  .release-version {
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .release-title {
    font-weight: 600;
  }

  .release-date {
    margin-left: auto;
    color: var(--set-dim);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .release-changes {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: baseline;
    gap: var(--space-3);
    line-height: 1.45;
    text-wrap: pretty;
  }

  .release-kind {
    display: flex;
  }
</style>
