<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    axis?: "y" | "x";
    fade?: boolean;
    label?: string;
    class?: string;
    children: Snippet;
  }

  let { axis = "y", fade = true, label, class: extra, children }: Props = $props();
</script>

<div class={["ui-scroll", extra]} class:ui-fade={fade} data-axis={axis} role={label ? "region" : undefined} aria-label={label}>
  {@render children()}
</div>

<style>
  @property --fade-start {
    syntax: "<length>";
    inherits: false;
    initial-value: 0px;
  }

  @property --fade-end {
    syntax: "<length>";
    inherits: false;
    initial-value: 0px;
  }

  .ui-scroll {
    --fade: var(--space-6);
    min-width: 0;
    min-height: 0;
    overflow: hidden auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
  }

  .ui-scroll::-webkit-scrollbar {
    display: none;
  }

  [data-axis="x"] {
    overflow: auto hidden;
  }

  /* CSS only: a scroll timeline drives each edge's fade, so an edge fades only while content is clipped there. With
     nothing to scroll the timeline is inactive and both fades stay 0; a browser without scroll timelines shows none. */
  .ui-fade {
    mask-image: linear-gradient(to bottom, transparent, black var(--fade-start), black calc(100% - var(--fade-end)), transparent);
    animation:
      fade-start linear both,
      fade-end linear both;
    animation-timeline: scroll(self block), scroll(self block);
    animation-range:
      0 var(--fade),
      calc(100% - var(--fade)) 100%;
  }

  .ui-fade[data-axis="x"] {
    mask-image: linear-gradient(to right, transparent, black var(--fade-start), black calc(100% - var(--fade-end)), transparent);
    animation-timeline: scroll(self inline), scroll(self inline);
  }

  @keyframes fade-start {
    from {
      --fade-start: 0px;
    }
    to {
      --fade-start: var(--fade);
    }
  }

  @keyframes fade-end {
    from {
      --fade-end: var(--fade);
    }
    to {
      --fade-end: 0px;
    }
  }
</style>
