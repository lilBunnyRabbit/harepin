<script lang="ts">
  import { CHANGELOG, type Release } from "../changelog";
  import { newer_releases, type VersionInfo } from "../version";
  import ReleaseHero from "./ReleaseHero.svelte";
  import ReleaseNotes from "./ReleaseNotes.svelte";
  import ReleaseStory from "./ReleaseStory.svelte";
  import ReleaseTimeline from "./ReleaseTimeline.svelte";
  import { timeline_of } from "./release-days";
  import { story_of } from "./release-story";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";
  import type { UpdateView } from "./update-view.svelte";

  interface Props {
    view: UpdateView;
    build: VersionInfo;
    onapply: () => void;
    releases?: readonly Release[];
    /** The version the player ran before this boot: newer releases are marked as new since then. */
    seen?: string | null;
    now?: Date;
  }

  let { view, build, onapply, releases = CHANGELOG, seen = null, now = new Date() }: Props = $props();

  const reading = $derived(releases.find((release) => release.version === view.reading));
  const story = $derived(reading ? story_of(reading) : null);
  const timeline = $derived(timeline_of(releases, seen, build.version));
  const open = (version: string) => (view.reading = version);
  const fresh = $derived(view.pending?.remote ? newer_releases(view.pending.remote.notes, build.version) : []);
</script>

<div class="changelog-page">
  {#if view.pending}
    <Card class="changelog-pending" label="Update ready">
      <div class="changelog-update">
        <span class="changelog-update-text">
          <b>Update ready{view.pending.remote ? ` · v${view.pending.remote.version}` : ""}</b>
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
      {#if timeline.latest}
        <ReleaseHero release={timeline.latest} story={story_of(timeline.latest)} fresh={timeline.fresh.has(timeline.latest.version)} {now} onopen={open} />
      {/if}
      <ReleaseTimeline {timeline} {now} onopen={open} />
    {/if}
  </div>
</div>

<style>
  .changelog-page {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
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
    grid-template-columns: minmax(0, 1fr);
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
</style>
