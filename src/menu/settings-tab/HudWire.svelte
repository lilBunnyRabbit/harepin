<script lang="ts">
  import type { MapView, SpeedoStyle } from "../prefs";
  import { wire_boxes } from "./sections";

  interface Props {
    map: MapView;
    speedo: SpeedoStyle;
  }

  let { map, speedo }: Props = $props();
</script>

<span class="set-wire" aria-hidden="true">
  {#each wire_boxes(map, speedo) as box (box.part)}
    <span class="set-wire-box" data-part={box.part} data-look={box.look} style:inset={box.inset}></span>
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
    display: grid;
    place-items: center;
    border-radius: var(--radius-xs);
    background: color-mix(in oklch, var(--foreground) 30%, transparent);
  }

  .set-wire-box::after {
    content: "";
  }

  [data-part="title"] {
    background: color-mix(in oklch, var(--foreground) 50%, transparent);
  }

  [data-look="line"] {
    background: color-mix(in oklch, var(--foreground) 14%, transparent);
  }

  [data-look="line"]::after {
    width: 70%;
    height: 56%;
    border: 2px solid var(--foreground);
    border-radius: 40% 60% 50% 50%;
  }

  [data-look="close"]::after {
    width: 22%;
    height: 100%;
    background: color-mix(in oklch, var(--foreground) 60%, transparent);
  }

  [data-look="pace"]::after {
    content: "3";
    font-size: var(--text-xs);
    font-weight: 700;
    line-height: 1;
  }

  [data-part="speed"] {
    background: var(--primary);
  }

  [data-look="dial"] {
    background: none;
  }

  [data-look="dial"]::after {
    box-sizing: border-box;
    height: 100%;
    aspect-ratio: 1;
    border: 3px solid var(--primary);
    border-radius: 50%;
  }
</style>
