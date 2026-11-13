<script lang="ts">
  import { CHANGELOG } from "../changelog";
  import { newer_releases, type VersionInfo } from "../version";
  import ReleaseNotes from "./ReleaseNotes.svelte";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";
  import type { UpdateView } from "./update-view.svelte";

  interface Props {
    view: UpdateView;
    build: VersionInfo;
    onapply: () => void;
  }

  let { view, build, onapply }: Props = $props();

  const fresh = $derived(view.pending?.remote ? newer_releases(view.pending.remote.notes, build.version) : []);
</script>

<div class="changelog-page">
  {#if view.pending}
    <Card variant="raised" class="changelog-pending" label="Update ready">
      <div class="changelog-update">
        <span class="changelog-update-text">
          <b>Update ready</b>
          <small>{view.pending.status}</small>
        </span>
        <Button variant="primary" disabled={view.pending.applying} onclick={onapply}>Update now</Button>
      </div>
      {#each fresh as release (release.version)}<ReleaseNotes {release} fresh />{/each}
    </Card>
  {/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="changelog" tabindex="0" role="region" aria-label="Release notes">
    <p class="changelog-build">You have v{build.version} · {build.commit}</p>
    {#each CHANGELOG as release (release.version)}<ReleaseNotes {release} />{/each}
  </div>
</div>

<style>
  .changelog-page {
    display: grid;
    gap: var(--space-5);
    font-size: var(--text-md);
  }

  .changelog-page > :global(.changelog-pending) {
    gap: var(--space-5);
  }

  .changelog-update {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3) var(--space-4);
  }

  .changelog-update-text {
    display: grid;
    gap: var(--space-0);
  }

  .changelog-update-text b {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .changelog-update-text small {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .changelog {
    display: grid;
    gap: var(--space-6);
    padding: var(--space-2) var(--space-4) var(--space-4);
    border-radius: var(--radius-md);
    outline: none;
  }

  .changelog:focus-visible {
    box-shadow: inset 0 0 0 2px var(--primary);
  }

  .changelog-build {
    margin: 0;
    color: var(--set-dim);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
</style>
