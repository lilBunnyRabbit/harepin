<script lang="ts">
  import type { Release } from "../changelog";
  import ReleaseNotes from "./ReleaseNotes.svelte";
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

<div class="updated" bind:this={frame}>
  <Dialog bind:open title={`Updated to v${version}`} subtitle={since} onclose={closed}>
    <div class="updated-notes">
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
</style>
