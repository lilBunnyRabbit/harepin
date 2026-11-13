<script lang="ts">
  import Button from "./ui/Button.svelte";
  import type { UpdateView } from "./update-view.svelte";

  interface Props {
    view: UpdateView;
    onopen: () => void;
  }

  let { view, onopen }: Props = $props();
</script>

{#if view.toast}
  <div class="update-toast">
    <Button onclick={onopen}><b>Update ready</b><span class="update-more">· what's new</span></Button>
  </div>
{/if}

<style>
  /* Under whatever holds the top: the dock (title and, on phones, the strip) or the top-centre strip / key list. */
  .update-toast {
    position: fixed;
    z-index: 40;
    position-anchor: --top-dock;
    top: calc(anchor(bottom) + var(--space-2));
    left: 50%;
    translate: -50% 0;
    animation: update-in 0.3s ease-out;
  }

  .update-more {
    color: var(--set-dim);
    font-weight: 400;
  }

  :global(body:has(> .settings:not([hidden]))) .update-toast {
    display: none;
  }

  @media (pointer: fine) {
    .update-toast {
      position-anchor: --top-centre;
    }
  }

  @keyframes update-in {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .update-toast {
      animation: none;
    }
  }
</style>
