<script lang="ts">
  import { map_spot } from "../menu/world-map.svelte";
  import type { MapRun } from "./map-overlay.svelte";

  interface Props {
    size: number | null;
    run: MapRun;
  }

  let { size, run }: Props = $props();

  const line = $derived(size === null ? "" : run.route.map((p) => map_spot(size, p.x, p.z).map((v) => (v * 1000).toFixed(1)).join(",")).join(" "));
  const rivals = $derived(size === null ? [] : run.rivals.map((r) => ({ name: r.name, at: map_spot(size, r.x, r.z) })));
</script>

{#if size !== null}
  <div class="map-run">
    {#if line}
      <svg viewBox="0 0 1000 1000" aria-hidden="true">
        {#if run.closed}
          <polygon class="casing" points={line} />
          <polygon class="route" points={line} />
        {:else}
          <polyline class="casing" points={line} />
          <polyline class="route" points={line} />
        {/if}
      </svg>
    {/if}
    {#each rivals as rival, i (i)}
      <span class="rival" style:left={`${rival.at[0] * 100}%`} style:top={`${rival.at[1] * 100}%`}>
        {#if rival.name}<b>{rival.name}</b>{/if}
      </span>
    {/each}
  </div>
{/if}

<style>
  .map-run {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: none;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  /* Pixel widths at any map size: a route stays a ribbon, not a hairline or a band. */
  .casing,
  .route {
    vector-effect: non-scaling-stroke;
  }

  .casing {
    stroke: var(--background-darkest);
    stroke-width: calc(var(--mark-w) * 3);
  }

  .route {
    stroke: var(--primary);
    stroke-width: var(--mark-w);
  }

  .rival {
    position: absolute;
    width: var(--gap-md);
    height: var(--gap-md);
    border: var(--mark-w) solid var(--background-darkest);
    border-radius: 50%;
    background: var(--accent);
    translate: -50% -50%;
  }

  .rival b {
    position: absolute;
    top: 50%;
    left: calc(100% + var(--gap-sm));
    color: var(--foreground);
    font-size: var(--type-small);
    white-space: nowrap;
    translate: 0 -50%;
    text-shadow: 0 0 var(--gap-xs) var(--background-darkest);
  }
</style>
