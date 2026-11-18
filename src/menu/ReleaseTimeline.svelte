<script lang="ts">
  import type { Release } from "../changelog";
  import ReleaseFold from "./ReleaseFold.svelte";
  import StoryNode from "./StoryNode.svelte";
  import { day_label, short_date, type Timeline } from "./release-days";
  import { story_of } from "./release-story";

  interface Props {
    timeline: Timeline;
    now: Date;
    onopen: (version: string) => void;
  }

  let { timeline, now, onopen }: Props = $props();

  const PREVIEW = 3;
  const days = $derived(
    timeline.days.map((day, index) => {
      const stories = day.releases.flatMap((release) => {
        const story = story_of(release);
        return story ? [{ release, story }] : [];
      });
      const rows = day.releases.filter((release) => !story_of(release));
      const fresh = day.releases.some((release) => timeline.fresh.has(release.version));
      return { ...day, label: day_label(day.date, now), stories, rows, fresh, open: index === 0 || fresh };
    }),
  );
  const count = (n: number) => `${n} ${n === 1 ? "update" : "updates"}`;
  const preview = (rows: Release[]) => rows.slice(0, PREVIEW).map((release) => release.title).join(", ") + (rows.length > PREVIEW ? "…" : "");
</script>

{#snippet seen_mark(release: Release)}
  {#if timeline.seen === release}
    <li class="spine-seen"><span>You last played v{release.version}</span></li>
  {/if}
{/snippet}

{#snippet rows_of(rows: Release[], below: boolean)}
  <ol class="spine-rows">
    {#each rows as release, index (release.version)}
      {#if index > 0 || below}{@render seen_mark(release)}{/if}
      <li><ReleaseFold {release} fresh={timeline.fresh.has(release.version)} /></li>
    {/each}
  </ol>
{/snippet}

<ol class="spine" aria-label="Earlier updates">
  {#each days as day (day.date)}
    {@render seen_mark(day.stories[0]?.release ?? day.rows[0])}
    <li class="spine-day">
      <header class="spine-head">
        <span class="spine-node" data-fresh={day.fresh ? "" : undefined}></span>
        <h3 class="spine-label">{day.label}</h3>
        <span class="spine-sub">{day.label === short_date(day.date) ? "" : `${short_date(day.date)} · `}{count(day.releases.length)}</span>
      </header>
      {#each day.stories as { release, story } (release.version)}
        <StoryNode {release} {story} fresh={timeline.fresh.has(release.version)} {onopen} />
      {/each}
      {#if day.open}
        {@render rows_of(day.rows, day.stories.length > 0)}
      {:else if day.rows.length}
        <details class="spine-fold">
          <summary class="spine-more">
            <span class="spine-more-count">{day.stories.length ? `${day.rows.length} more` : count(day.rows.length)}</span>
            <span class="spine-more-titles">{preview(day.rows)}</span>
          </summary>
          {@render rows_of(day.rows, day.stories.length > 0)}
        </details>
      {/if}
    </li>
  {/each}
</ol>

<style>
  /* One line down the left edge: a node per day, the rows hang off it. */
  .spine {
    --spine-x: calc(var(--gap-md) / 2 + 1px);
    position: relative;
    display: grid;
    gap: calc(2 * var(--gap));
    margin: 0;
    padding: 0 0 0 calc(2 * var(--gap));
    list-style: none;
  }

  .spine::before {
    content: "";
    position: absolute;
    top: var(--gap-sm);
    bottom: 0;
    left: var(--spine-x);
    width: 2px;
    background: var(--line);
  }

  .spine-day {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--gap-md);
  }

  .spine-head {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-0) var(--gap-md);
  }

  .spine-node {
    position: absolute;
    top: 0.45em;
    left: calc(-2 * var(--gap) + var(--spine-x) - var(--gap-md) / 2 + 1px);
    width: var(--gap-md);
    height: var(--gap-md);
    border: 2px solid var(--line-strong);
    border-radius: var(--radius-full);
    background: var(--panel);
  }

  .spine-node[data-fresh] {
    border-color: var(--primary);
    background: var(--primary);
  }

  .spine-label {
    margin: 0;
    font-size: var(--type-h3);
    font-weight: 700;
  }

  .spine-sub {
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: var(--type-eyebrow);
  }

  .spine-fold {
    display: grid;
  }

  .spine-fold[open] {
    gap: var(--gap-sm);
  }

  .spine-more {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: var(--gap-md);
    padding: var(--gap-sm) var(--gap-md);
    border-radius: var(--radius-md);
    color: var(--dim);
    list-style: none;
  }

  .spine-more::-webkit-details-marker {
    display: none;
  }

  .spine-more:hover {
    background: var(--row);
  }

  .spine-more-count {
    flex: none;
    color: var(--foreground);
    font-weight: 600;
  }

  .spine-more::after {
    content: "";
    flex: none;
    width: 0.5em;
    height: 0.5em;
    margin-left: auto;
    border-right: 2px solid var(--dim);
    border-bottom: 2px solid var(--dim);
    transform: translateY(-25%) rotate(45deg);
    align-self: center;
  }

  .spine-fold[open] .spine-more::after {
    transform: translateY(25%) rotate(-135deg);
  }

  .spine-more-titles {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .spine-fold[open] .spine-more-titles {
    display: none;
  }

  .spine-rows {
    display: grid;
    gap: var(--space-0);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .spine-seen {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    margin: var(--gap-sm) 0;
    color: var(--primary);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .spine-seen::before,
  .spine-seen::after {
    content: "";
    flex: 1;
    height: 2px;
    background: var(--primary);
  }

  .spine-seen::before {
    flex: none;
    width: var(--gap-md);
  }
</style>
