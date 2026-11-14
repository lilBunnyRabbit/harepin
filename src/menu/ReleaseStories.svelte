<script lang="ts">
  import type { Release } from "../changelog";
  import KindBadge from "./KindBadge.svelte";
  import ReleaseBanner from "./ReleaseBanner.svelte";
  import { story_of } from "./release-story";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";
  import RowList from "./ui/RowList.svelte";

  interface Props {
    releases: readonly Release[];
    onopen: (version: string) => void;
  }

  let { releases, onopen }: Props = $props();

  const told = $derived(releases.flatMap((release) => {
    const story = story_of(release);
    return story ? [{ release, story }] : [];
  }));
  const lead = $derived(told[0]);
  const older = $derived(told.slice(1));
</script>

{#if lead}
  <div class="stories">
    <Card variant="raised" class="stories-lead" label={`What's new in v${lead.release.version}`}>
      <ReleaseBanner story={lead.story} />
      <div class="stories-lead-body">
        <p class="stories-meta">
          <span>v{lead.release.version}</span>
          <time datetime={lead.release.date}>{lead.release.date}</time>
        </p>
        <h3 class="stories-title">{lead.release.title}</h3>
        <ul class="stories-tops">
          {#each lead.story.tops as top (top.title)}
            <li>
              <span class="stories-kind"><KindBadge kind={top.kind} /></span>
              <span><b>{top.title}.</b> {top.text}</span>
            </li>
          {/each}
        </ul>
        <Button variant="primary" size="lg" class="stories-open" onclick={() => onopen(lead.release.version)}>See what's new</Button>
      </div>
    </Card>
    {#if older.length}
      <RowList divided label="Earlier updates">
        {#each older as { release } (release.version)}
          <div class="stories-row">
            <span class="stories-row-text">
              <b>{release.title}</b>
              <small>v{release.version} · <time datetime={release.date}>{release.date}</time></small>
            </span>
            <Button aria-label={`See what's new in v${release.version}`} onclick={() => onopen(release.version)}>See what's new</Button>
          </div>
        {/each}
      </RowList>
    {/if}
  </div>
{/if}

<style>
  .stories {
    display: grid;
    gap: var(--space-4);
  }

  .stories > :global(.stories-lead) {
    gap: 0;
    padding: 0;
    overflow: hidden;
  }

  .stories-lead-body {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5) var(--space-5);
  }

  .stories-meta {
    display: flex;
    gap: var(--space-2);
    margin: 0;
    color: var(--set-dim);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .stories-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 700;
  }

  .stories-tops {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-2) var(--space-3);
    margin: 0 0 var(--space-2);
    padding: 0;
    list-style: none;
  }

  .stories-tops li {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: baseline;
    line-height: 1.4;
    text-wrap: pretty;
  }

  .stories-kind {
    display: flex;
  }

  .stories-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-3) var(--space-1);
  }

  .stories-row-text {
    display: grid;
    gap: var(--space-0);
    min-width: 0;
  }

  .stories-row-text small {
    color: var(--set-dim);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  @media (max-width: 600px) {
    .stories-lead-body :global(.stories-open) {
      justify-self: stretch;
    }
  }
</style>
