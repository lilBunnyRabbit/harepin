<script lang="ts">
  import { SCENES, VIEW_BOX, type TourArt } from "./tour-scenes";

  interface Props {
    scene: TourArt;
  }

  let { scene }: Props = $props();
</script>

<svg class="tour-art" viewBox={VIEW_BOX} aria-hidden="true">
  {#each SCENES[scene] as [tag, part, attributes], index (index)}
    {#if tag === "path"}<path class="art-{part}" {...attributes} />
    {:else if tag === "rect"}<rect class="art-{part}" {...attributes} />
    {:else if tag === "circle"}<circle class="art-{part}" {...attributes} />
    {:else}<ellipse class="art-{part}" {...attributes} />
    {/if}
  {/each}
</svg>

<style>
  .tour-art {
    --art-hill: var(--set-soft);
    --art-ground: var(--set-raised);
    --art-road: var(--set-well);
    --art-ink: var(--background-darkest);
    display: block;
    width: 100%;
    height: 100%;
  }

  :global(:root[data-scheme="light"]) .tour-art {
    --art-hill: var(--background);
    --art-ground: var(--background-darker);
    --art-road: var(--background-darkest);
    --art-ink: var(--foreground);
  }

  :is(.art-hill, .art-wall, .art-turntable) {
    fill: var(--art-hill);
  }

  .art-ground {
    fill: var(--art-ground);
  }

  .art-road {
    fill: var(--art-road);
  }

  :is(.art-tyre, .art-glass, .art-flag-dark, .art-post) {
    fill: var(--art-ink);
  }

  .art-frame {
    fill: var(--background-darkest);
  }

  :is(.art-door, .art-bubble) {
    fill: var(--set-panel);
  }

  .art-hub {
    fill: var(--set-raised);
  }

  .art-mark {
    fill: var(--set-dim);
  }

  .art-flag-light {
    fill: var(--foreground);
  }

  :global(:root[data-scheme="light"]) .art-flag-light {
    fill: var(--background-lightest);
  }

  :is(.art-car, .art-star) {
    fill: var(--primary);
  }

  :is(.art-car-friend, .art-chip-secondary) {
    fill: var(--secondary);
  }

  :is(.art-cone, .art-chip-accent) {
    fill: var(--accent);
  }

  .art-chip-tertiary {
    fill: var(--tertiary);
  }

  .art-link {
    fill: none;
    stroke: var(--foreground);
    stroke-width: 2.5;
  }
</style>
