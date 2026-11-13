<script lang="ts">
  import type { HudLayout, MapView } from "../prefs";
  import { wire_boxes } from "./sections";

  interface Props {
    hud: HudLayout;
    map: MapView;
  }

  let { hud, map }: Props = $props();
</script>

<span class="set-wire" aria-hidden="true">
  {#each wire_boxes(hud, map) as box (box.part)}
    <span class="set-wire-box" data-part={box.part} class:set-wire-card={box.card} style:inset={box.inset}></span>
  {/each}
</span>

<style>
  .set-wire {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-xs);
    background: color-mix(in oklch, var(--foreground) 8%, transparent);
  }

  .set-wire-box {
    position: absolute;
    border-radius: var(--radius-xs);
    background: color-mix(in oklch, var(--foreground) 30%, transparent);
  }

  [data-part="map"]:not(.set-wire-card) {
    border-radius: 50%;
  }

  [data-part="strip"] {
    background: color-mix(in oklch, var(--foreground) 50%, transparent);
  }

  [data-part="speed"] {
    background: var(--primary);
  }
</style>
