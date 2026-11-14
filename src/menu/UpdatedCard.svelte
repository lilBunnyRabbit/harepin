<script lang="ts">
  import type { Release } from "../changelog";
  import KindBadge from "./KindBadge.svelte";
  import ReleaseBanner from "./ReleaseBanner.svelte";
  import ReleaseNotes from "./ReleaseNotes.svelte";
  import { story_of } from "./release-story";
  import Button from "./ui/Button.svelte";
  import Dialog from "./ui/Dialog.svelte";
  import Link from "./ui/Link.svelte";

  interface Props {
    version: string;
    since: string;
    releases: readonly Release[];
    onnotes: () => void;
    onclosed: () => void;
  }

  let { version, since, releases, onnotes, onclosed }: Props = $props();

  // A release with a story leads the card: its picture, its headlines, and the way into the rest.
  const story = $derived(releases.length ? story_of(releases[0]) : null);

  let open = $state(true);
  let notes = false;
  let frame = $state<HTMLElement>();

  // Esc closes the card only, so the menu behind keeps its page; arrows go on to the menu's pad navigation.
  // A click that lands on the dialog element outside its box is the backdrop.
  $effect(() => {
    const node = frame?.querySelector("dialog");
    if (!node) return;
    const key = (event: KeyboardEvent) => event.key.startsWith("Arrow") || event.stopPropagation();
    const click = (event: MouseEvent) => {
      const box = node.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (event.target === node && !inside) open = false;
    };
    node.addEventListener("keydown", key);
    node.addEventListener("click", click);
    return () => {
      node.removeEventListener("keydown", key);
      node.removeEventListener("click", click);
    };
  });

  function closed() {
    onclosed();
    if (notes) onnotes();
  }
</script>

{#snippet banner()}
  {#if story}<ReleaseBanner {story} />{/if}
{/snippet}

<div class="updated" bind:this={frame}>
  {#if story}
    <Dialog bind:open title={releases[0].title} subtitle={`Updated to v${version} · ${since.charAt(0).toLowerCase()}${since.slice(1)}`} {banner} onclose={closed}>
      <ul class="updated-tops">
        {#each story.tops as top (top.title)}
          <li>
            <span class="updated-kind"><KindBadge kind={top.kind} /></span>
            <span><b>{top.title}.</b> {top.text}</span>
          </li>
        {/each}
      </ul>
      {#snippet actions()}
        <!-- First in the markup so it takes the dialog's focus; `order` keeps it on the right. -->
        <Button
          variant="primary"
          size="lg"
          class="updated-more"
          onclick={() => {
            notes = true;
            open = false;
          }}>See what's new</Button
        >
        <Button variant="quiet" size="lg" onclick={() => (open = false)}>Got it</Button>
      {/snippet}
    </Dialog>
  {:else}
    <Dialog bind:open title={`Updated to v${version}`} subtitle={since} onclose={closed}>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="updated-notes" tabindex="0" role="region" aria-label="Release notes">
        {#each releases as release (release.version)}<ReleaseNotes {release} />{/each}
      </div>
      {#snippet actions()}
        <Link
          onclick={() => {
            notes = true;
            open = false;
          }}>Full notes</Link
        >
        <!-- svelte-ignore a11y_autofocus -->
        <Button variant="primary" size="lg" autofocus onclick={() => (open = false)}>Got it</Button>
      {/snippet}
    </Dialog>
  {/if}
</div>

<style>
  .updated {
    display: contents;
  }

  .updated-notes {
    display: grid;
    gap: var(--space-6);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--set-well);
  }

  .updated-tops {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-lg);
  }

  .updated-tops li {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: baseline;
    line-height: 1.4;
    text-wrap: pretty;
  }

  .updated-tops b {
    font-weight: 700;
  }

  .updated :global(.updated-more) {
    order: 1;
  }

  .updated-kind {
    display: flex;
  }

  @media (max-height: 500px) {
    .updated-tops {
      gap: var(--space-2);
      font-size: var(--text-md);
    }
  }

  .updated-notes:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }
</style>
