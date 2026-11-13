<script lang="ts">
  import type { Snippet } from "svelte";
  import type { WorldMap } from "./world-map.svelte";

  interface Props {
    map: WorldMap;
    label: string;
    children?: Snippet;
  }

  let { map, label, children }: Props = $props();

  let canvas = $state<HTMLCanvasElement>();
  let cars = $state<HTMLCanvasElement>();

  $effect(() => {
    if (!canvas || !cars) return;
    map.attach(canvas, cars);
    return () => map.detach();
  });
</script>

<div class="map" data-status={map.status} style:--map-edge={map.edge}>
  <div class="paint" role="img" aria-label={label}>
    <canvas bind:this={canvas}></canvas>
    <canvas bind:this={cars} class="cars"></canvas>
  </div>
  {#if map.note}<span class="note">{map.note}</span>{/if}
  {@render children?.()}
</div>

<style>
  .map {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--map-edge, var(--set-well));
    font-family: var(--font-sans);
  }

  .paint {
    position: relative;
    height: 100%;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: opacity 160ms ease-out;
  }

  .cars {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  [data-status="drawing"] canvas,
  [data-status="failed"] canvas {
    opacity: 0.4;
  }

  [data-status="drawing"] .cars,
  [data-status="failed"] .cars {
    display: none;
  }

  .note {
    position: absolute;
    inset: 50% var(--space-4) auto;
    translate: 0 -50%;
    color: var(--foreground);
    font-size: var(--text-md);
    font-weight: 600;
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    canvas {
      transition: none;
    }
  }
</style>
