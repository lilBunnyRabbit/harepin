<script lang="ts">
  import type { Release } from "../changelog";
  import ReleaseBanner from "./ReleaseBanner.svelte";
  import type { Story } from "./release-story";
  import Badge from "./ui/Badge.svelte";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";

  interface Props {
    release: Release;
    story: Story;
    fresh: boolean;
    onopen: (version: string) => void;
  }

  let { release, story, fresh, onopen }: Props = $props();
</script>

<Card class="story-node" label={`Big update: v${release.version}`}>
  <div class="story-node-pic"><ReleaseBanner {story} /></div>
  <div class="story-node-body">
    <p class="story-node-meta">
      <span>v{release.version}</span>
      {#if fresh}<Badge tone="primary">New</Badge>{/if}
    </p>
    <h3 class="story-node-title">{release.title}</h3>
    <p class="story-node-lede">{story.tops.map((top) => top.title).join(" · ")}</p>
    <Button aria-label={`See what's new in v${release.version}`} onclick={() => onopen(release.version)}>See what's new</Button>
  </div>
</Card>

<style>
  :global(.ui-card.story-node) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    padding: 0;
    overflow: hidden;
  }

  .story-node-body {
    display: grid;
    justify-items: start;
    align-content: center;
    gap: var(--gap-sm);
    padding: var(--gap) var(--pad) var(--pad);
  }

  .story-node-meta {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    margin: 0;
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: var(--type-eyebrow);
  }

  .story-node-title {
    margin: 0;
    font-size: var(--type-h3);
    font-weight: 700;
  }

  .story-node-lede {
    margin: 0 0 var(--gap-sm);
    color: var(--dim);
    text-wrap: pretty;
  }

  @media (min-width: 720px) {
    :global(.ui-card.story-node) {
      grid-template-columns: minmax(0, 5fr) minmax(0, 4fr);
    }

    .story-node-pic {
      display: grid;
      align-items: end;
      background: var(--row);
    }
  }
</style>
