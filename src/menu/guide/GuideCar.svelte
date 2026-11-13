<script lang="ts">
  import { STATS, build_spec, parse_build, stats } from "../../car/build";
  import { rating } from "../../car/pi";
  import { PRESETS } from "../../car/presets";
  import { STAT_NAMES, stat_rating } from "../garage-meters";
  import Badge from "../ui/Badge.svelte";
  import Card from "../ui/Card.svelte";
  import ClassBadge from "../ui/ClassBadge.svelte";
  import GuideLayout from "./GuideLayout.svelte";
  import type { GuideState } from "./guide.svelte";

  interface Props {
    guide: GuideState;
  }

  let { guide }: Props = $props();

  const cars = PRESETS.flatMap(({ name, blurb, code }) => {
    const build = parse_build(code);
    if (!build) return [];
    const rated = stats(build_spec(build));
    const hint = STATS.filter((key) => key !== "braking")
      .map((key) => `${STAT_NAMES[key]} ${stat_rating(key, rated[key])}`)
      .join(" · ");
    return [{ name, blurb, code, hint, rating: rating(build) }];
  });
</script>

<GuideLayout title="Pick a car" lede="A ready-made build to start in. Swap any part later in the Garage.">
  {#snippet copy()}
    <div class="guide-cars" role="group" aria-label="Cars">
      {#each cars as car, at (car.code)}
        <Card selected={car.code === guide.car} onclick={() => guide.use_car(car.code)}>
          <span class="guide-car-head">
            <b class="guide-car-name">{car.name}</b>
            <ClassBadge rating={car.rating} />
            {#if at === 0}<Badge tone="primary">Recommended</Badge>{/if}
          </span>
          <span class="guide-car-blurb">{car.blurb}</span>
          <span class="guide-car-stats">{car.hint}</span>
        </Card>
      {/each}
    </div>
  {/snippet}
</GuideLayout>

<style>
  .guide-cars {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .guide-car-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
  }

  .guide-car-name {
    font-size: var(--text-xl);
    font-weight: 700;
    line-height: 1.2;
  }

  .guide-car-blurb {
    color: var(--set-dim);
    font-size: var(--text-md);
    line-height: 1.45;
    text-wrap: pretty;
  }

  .guide-car-stats {
    margin-top: auto;
    color: var(--set-dim);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 600;
  }

  @media (max-width: 600px) {
    .guide-cars {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-height: 500px) {
    .guide-cars {
      gap: var(--space-3);
    }

    .guide-car-stats {
      display: none;
    }
  }
</style>
