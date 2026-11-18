<script lang="ts">
  import type { Release } from "../changelog";
  import ChangeList from "./ChangeList.svelte";
  import KindBadge from "./KindBadge.svelte";
  import ReleaseBanner from "./ReleaseBanner.svelte";
  import { day_label } from "./release-days";
  import type { Story } from "./release-story";
  import Badge from "./ui/Badge.svelte";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";

  interface Props {
    release: Release;
    story: Story | null;
    fresh: boolean;
    now: Date;
    onopen: (version: string) => void;
  }

  let { release, story, fresh, now, onopen }: Props = $props();
</script>

<Card class="hero" label={`Latest: v${release.version}`}>
  {#if story}<ReleaseBanner {story} />{/if}
  <div class="hero-body">
    <p class="hero-meta">
      <span class="hero-eyebrow">Latest</span>
      <span>v{release.version}</span>
      <time datetime={release.date}>{day_label(release.date, now)}</time>
      {#if fresh}<Badge tone="primary">New</Badge>{/if}
    </p>
    <h2 class="hero-title">{release.title}</h2>
    {#if story}
      <ul class="hero-tops">
        {#each story.tops as top (top.title)}
          <li>
            <span class="hero-kind"><KindBadge kind={top.kind} /></span>
            <span><b>{top.title}.</b> {top.text}</span>
          </li>
        {/each}
      </ul>
      <Button variant="primary" size="lg" class="hero-open" onclick={() => onopen(release.version)}>See what's new</Button>
    {:else}
      <ChangeList changes={release.changes} />
    {/if}
  </div>
</Card>

<style>
  :global(.ui-card.hero) {
    gap: 0;
    padding: 0;
    overflow: hidden;
  }

  .hero-body {
    display: grid;
    justify-items: start;
    gap: var(--gap-md);
    padding: var(--pad);
  }

  .hero-body > :global(.changes) {
    justify-self: stretch;
  }

  .hero-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gap-xs) var(--gap-md);
    margin: 0;
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: var(--type-eyebrow);
  }

  .hero-eyebrow {
    color: var(--primary);
    font-family: var(--font-sans);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hero-title {
    margin: 0;
    font-size: var(--type-h1);
    font-weight: 700;
    line-height: 1.15;
  }

  .hero-tops {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--gap-sm) var(--gap-md);
    margin: 0 0 var(--gap-sm);
    padding: 0;
    list-style: none;
  }

  .hero-tops li {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: baseline;
    line-height: 1.4;
    text-wrap: pretty;
  }

  .hero-kind {
    display: flex;
  }

  @media (max-width: 600px) {
    .hero-body :global(.hero-open) {
      justify-self: stretch;
    }
  }
</style>
