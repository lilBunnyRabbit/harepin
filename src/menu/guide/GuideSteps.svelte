<script lang="ts">
  import Tabs from "../ui/Tabs.svelte";
  import { GUIDE_STEPS, type GuideState, type GuideStep } from "./guide.svelte";

  interface Props {
    guide: GuideState;
  }

  let { guide }: Props = $props();

  const items = GUIDE_STEPS.map(({ id, label }) => ({ id, label }));
  let rail = $state<HTMLElement>();

  // The rail scrolls sideways on a phone; the step a Next or Back lands on stays in view.
  $effect(() => {
    void guide.step;
    rail?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
</script>

<div class="guide-steps" bind:this={rail}>
  <Tabs {items} value={guide.id} variant="steps" label="Guide steps" onchange={(id: GuideStep) => guide.go(GUIDE_STEPS.findIndex((step) => step.id === id))} />
</div>

<style>
  .guide-steps {
    display: flex;
    min-width: 0;
  }
</style>
