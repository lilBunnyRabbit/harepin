<script lang="ts">
  import type { Release } from "../changelog";
  import ChangeList from "./ChangeList.svelte";
  import Badge from "./ui/Badge.svelte";

  interface Props {
    release: Release;
    fresh?: boolean;
  }

  let { release, fresh = false }: Props = $props();
</script>

<section class="release">
  <p class="release-line">
    <b class="release-version">v{release.version}</b>
    <span class="release-title">{release.title}</span>
    {#if fresh}<Badge tone="primary">New</Badge>{/if}
    <time class="release-date" datetime={release.date}>{release.date}</time>
  </p>
  <ChangeList changes={release.changes} />
</section>

<style>
  .release {
    display: grid;
    gap: var(--gap-md);
  }

  .release-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gap-xs) var(--gap-sm);
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
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: var(--type-eyebrow);
  }
</style>
