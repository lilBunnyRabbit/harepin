<script lang="ts">
  import { LISTED } from "../../worlds/worlds";
  import Tile from "../ui/Tile.svelte";
  import GuideLayout from "./GuideLayout.svelte";
  import type { GuideState } from "./guide.svelte";

  interface Props {
    guide: GuideState;
  }

  let { guide }: Props = $props();
</script>

<GuideLayout title="Ready to drive" lede="Where to first? The mainland is where everyone meets; switch any time from Play.">
  {#snippet copy()}
    <div class="guide-worlds" role="group" aria-label="Maps">
      {#each LISTED as world (world.kind)}
        <Tile title={world.name} meta={world.note} thumb={guide.host.picture(world.kind).src} selected={world.kind === guide.world} onclick={() => (guide.world = world.kind)} />
      {/each}
    </div>
  {/snippet}
</GuideLayout>

<style>
  .guide-worlds {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }

  @media (max-width: 1100px) {
    .guide-worlds {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 600px) {
    .guide-worlds {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-height: 500px) {
    .guide-worlds {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
