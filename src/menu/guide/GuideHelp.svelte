<script lang="ts">
  import { Device } from "../device";
  import { AidPreset, preset_aids, preset_of } from "../guide-rules";
  import Card from "../ui/Card.svelte";
  import GuideDash from "./GuideDash.svelte";
  import GuideLayout from "./GuideLayout.svelte";
  import GuideLights from "./GuideLights.svelte";
  import { AID_LIGHTS, PRESETS, aid_note, pro_text } from "./guide-text";
  import type { GuideState } from "./guide.svelte";

  interface Props {
    guide: GuideState;
  }

  let { guide }: Props = $props();

  const touch = $derived(guide.device === Device.TOUCH);
  const current = $derived(preset_of(guide.prefs, touch));
  const presets = $derived(
    PRESETS.map(([preset, name, text]) => ({
      preset,
      name,
      aids: preset_aids(preset, touch),
      text: preset === AidPreset.PRO ? pro_text(guide.prefs.bindings, guide.device) : text,
    })),
  );

  function pick(preset: AidPreset) {
    const aids = preset_aids(preset, touch);
    for (const [key] of AID_LIGHTS) guide.set(key, aids[key]);
  }
</script>

<GuideLayout title="How much help?" lede="Aids keep the car tidy while you learn. Turn any of them off later.">
  {#snippet copy()}
    <div class="guide-aids" role="group" aria-label="Driving aids">
      {#each presets as option (option.preset)}
        <Card selected={option.preset === current} onclick={() => pick(option.preset)}>
          <span class="guide-aid-head">
            <b class="guide-aid-name">{option.name}</b>
            <GuideLights aids={option.aids} />
          </span>
          <span class="guide-aid-text">{option.text}</span>
        </Card>
      {/each}
    </div>
  {/snippet}
  {#snippet visual()}
    <GuideDash aids={guide.prefs} />
    <small class="guide-help">{aid_note(guide.prefs.bindings, guide.device)}</small>
  {/snippet}
</GuideLayout>

<style>
  .guide-aids {
    display: grid;
    gap: var(--space-3);
  }

  .guide-aid-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
  }

  .guide-aid-name {
    font-size: var(--text-xl);
    font-weight: 700;
    line-height: 1.2;
  }

  .guide-aid-text {
    color: var(--set-dim);
    font-size: var(--text-md);
    line-height: 1.45;
    text-wrap: pretty;
  }

  .guide-help {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    text-wrap: pretty;
  }

  @media (max-height: 500px) {
    .guide-aids {
      gap: var(--space-2);
    }

    .guide-aid-text {
      display: none;
    }
  }
</style>
