<script lang="ts">
  import { CHANGELOG, type Release } from "../changelog";
  import { newer_releases, type VersionInfo } from "../version";
  import ReleaseNotes from "./ReleaseNotes.svelte";
  import ReleaseStories from "./ReleaseStories.svelte";
  import ReleaseStory from "./ReleaseStory.svelte";
  import { story_of } from "./release-story";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";
  import type { UpdateView } from "./update-view.svelte";

  interface Props {
    view: UpdateView;
    build: VersionInfo;
    onapply: () => void;
    releases?: readonly Release[];
  }

  let { view, build, onapply, releases = CHANGELOG }: Props = $props();

  const reading = $derived(releases.find((release) => release.version === view.reading));
  const story = $derived(reading ? story_of(reading) : null);
  // The page leads with the build the player has: its notes come first unless it is a big update, whose story card does.
  const newest = $derived(releases[0] && !story_of(releases[0]) ? releases[0] : null);
  const fresh = $derived(view.pending?.remote ? newer_releases(view.pending.remote.notes, build.version) : []);
</script>

<div class="changelog-page">
  {#if view.pending}
    <Card class="changelog-pending" label="Update ready">
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
    {#if reading && story}
      <div class="changelog-back" {@attach (node) => node.querySelector("button")?.focus()}>
        <Button variant="quiet" size="sm" icon="icon-back" onclick={() => (view.reading = null)}>All updates</Button>
      </div>
      <ReleaseStory release={reading} {story} />
    {:else}
      <p class="changelog-build">You have v{build.version} · {build.commit}</p>
      {#if newest}<ReleaseNotes release={newest} />{/if}
      <ReleaseStories {releases} onopen={(version) => (view.reading = version)} />
      {#each newest ? releases.slice(1) : releases as release (release.version)}<ReleaseNotes {release} />{/each}
    {/if}
  </div>
</div>

<style>
  .changelog-page {
    display: grid;
    gap: var(--pad);
    font-size: var(--type-body);
  }

  .changelog-page > :global(.changelog-pending) {
    gap: var(--pad);
  }

  .changelog-update {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-md) var(--gap);
  }

  .changelog-update-text {
    display: grid;
    gap: var(--space-0);
  }

  .changelog-update-text b {
    font-size: var(--type-body);
    font-weight: 600;
  }

  .changelog-update-text small {
    color: var(--dim);
    font-size: var(--type-small);
  }

  .changelog {
    display: grid;
    gap: calc(2 * var(--gap-md));
    padding: var(--gap-sm) var(--gap) var(--gap);
    border-radius: var(--radius-md);
    outline: none;
  }

  .changelog:focus-visible {
    box-shadow: inset 0 0 0 2px var(--primary);
  }

  .changelog-back {
    display: flex;
  }

  .changelog-build {
    margin: 0;
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: var(--type-eyebrow);
  }
</style>
