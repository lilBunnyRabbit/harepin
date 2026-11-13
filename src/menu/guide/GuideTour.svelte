<script lang="ts">
  import Badge from "../ui/Badge.svelte";
  import Card from "../ui/Card.svelte";
  import GuideLayout from "./GuideLayout.svelte";
  import TourArt from "./TourArt.svelte";
  import { MINIS } from "../../worlds/worlds";
  import { tour_lede } from "./guide-text";
  import type { GuideState } from "./guide.svelte";
  import { TourArt as Scene } from "./tour-scenes";

  interface Props {
    guide: GuideState;
  }

  let { guide }: Props = $props();

  const minis = new Intl.ListFormat("en", { type: "conjunction" }).format(MINIS.map((world) => world.name));
  const TOUR = [
    { art: null, title: "Mainland", text: `Six kilometres of towns and open road, where the lobby meets. Mini maps: ${minis}.`, where: "Play" },
    { art: Scene.MODES, title: "Modes", text: "Race, gymkhana, parking, drift, hunt, duel. Stars and best times for each.", where: "Play, Modes" },
    { art: Scene.GARAGE, title: "Garage", text: "Switch cars, from a hatchback to a city bus. Swap engine, tyres and paint, save builds.", where: "Garage" },
    { art: Scene.FRIENDS, title: "Friends", text: "Send a link and friends drive your map with you. Race the lobby.", where: "Online" },
  ];
</script>

<GuideLayout title="What's here" lede={tour_lede(guide.device)}>
  {#snippet copy()}
    <div class="guide-pics">
      {#each TOUR as stop (stop.title)}
        <Card variant="well" class="guide-pic" label={stop.title}>
          <span class="guide-art">
            {#if stop.art}<TourArt scene={stop.art} />{:else}<img src={guide.host.picture("mainland").src} alt="" decoding="async" />{/if}
            <span class="guide-where"><Badge>{stop.where}</Badge></span>
          </span>
          <span class="guide-words">
            <b>{stop.title}</b>
            <span>{stop.text}</span>
          </span>
        </Card>
      {/each}
    </div>
  {/snippet}
</GuideLayout>

<style>
  .guide-pics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .guide-pics > :global(.guide-pic) {
    padding: 0;
    overflow: hidden;
    gap: 0;
  }

  .guide-art {
    position: relative;
    display: block;
    min-height: 0;
    overflow: hidden;
    aspect-ratio: 16 / 10;
    background: var(--set-well);
  }

  .guide-art > img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .guide-where {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    display: flex;
  }

  .guide-words {
    display: grid;
    flex: 1;
    align-content: start;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4) var(--space-4);
    border-top: 1px solid var(--set-line);
    background: var(--set-panel);
  }

  .guide-words b {
    font-size: var(--text-xl);
    font-weight: 700;
    line-height: 1.2;
  }

  .guide-words span {
    color: var(--set-dim);
    font-size: var(--text-md);
    line-height: 1.45;
    text-wrap: pretty;
  }

  @media (max-width: 1100px) {
    .guide-pics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 600px) {
    .guide-pics {
      grid-template-columns: minmax(0, 1fr);
    }

    .guide-art {
      aspect-ratio: 16 / 7;
    }
  }

  @media (max-height: 500px) {
    .guide-pics {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--space-3);
    }

    .guide-art {
      aspect-ratio: 5 / 2;
    }

    .guide-words {
      padding: var(--space-2) var(--space-3) var(--space-3);
    }

    .guide-words b {
      font-size: var(--text-lg);
    }

    .guide-words span {
      font-size: var(--text-sm);
    }
  }
</style>
