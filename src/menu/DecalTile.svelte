<script lang="ts">
  import type { Decal } from "../car/build";
  import { DECAL_VIEW_BOX, decal_shapes } from "./garage-widgets";

  interface Props {
    decal: Decal;
    number: number;
  }

  let { decal, number }: Props = $props();

  const shapes = $derived(decal_shapes(decal));
</script>

<svg class="decal-tile garage-decal" viewBox={DECAL_VIEW_BOX} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  {#each shapes as shape, index (index)}
    <svelte:element this={shape.tag} {...shape.attributes}>{shape.tag === "text" ? number : ""}</svelte:element>
  {/each}
</svg>

<style>
  .garage-decal {
    --decal-glass: var(--background-darkest);
    width: 96px;
  }

  :global(:root[data-scheme="light"]) .garage-decal {
    --decal-glass: var(--foreground);
  }

  @media (orientation: landscape) and (max-height: 500px), (max-width: 700px) {
    .garage-decal {
      width: 72px;
    }
  }
</style>
