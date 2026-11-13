<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    picture: string;
    tag: string;
    children?: Snippet;
  }

  let { picture, tag, children }: Props = $props();
</script>

<div class="guide-shot">
  <img src={picture} alt="" decoding="async" />
  <span class="guide-tag">{tag}</span>
  {#if children}<div class="guide-over">{@render children()}</div>{/if}
</div>

<style>
  .guide-shot {
    position: relative;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-well);
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .guide-tag {
    position: absolute;
    top: 58%;
    left: 50%;
    max-width: calc(100% - 2 * var(--space-4));
    overflow: hidden;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    background: var(--surface);
    font-size: var(--text-md);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
    translate: -50% -100%;
  }

  .guide-over {
    position: absolute;
    right: var(--space-4);
    bottom: var(--space-4);
    width: 55%;
  }
</style>
