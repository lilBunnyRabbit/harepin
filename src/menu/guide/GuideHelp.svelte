<script lang="ts">
  import { Device } from "../device";
  import { AidPreset, preset_aids, preset_of } from "../guide-rules";
  import Segmented from "../ui/Segmented.svelte";
  import GuideDash from "./GuideDash.svelte";
  import GuideLayout from "./GuideLayout.svelte";
  import { AID_LIGHTS, PRESETS, aid_note, pro_text } from "./guide-text";
  import type { GuideState } from "./guide.svelte";

  interface Props {
    guide: GuideState;
  }

  let { guide }: Props = $props();

  const MIXED = "mixed";
  const options = PRESETS.map(([value, label]) => ({ value, label }));
  const touch = $derived(guide.device === Device.TOUCH);
  const current = $derived(preset_of(guide.prefs, touch) ?? MIXED);
  const text = $derived.by(() => {
    if (current === AidPreset.PRO) return pro_text(guide.prefs.bindings, guide.device);
    return PRESETS.find(([preset]) => preset === current)?.[2] ?? "Your own mix. Pick a preset to start over from it.";
  });

  function pick(preset: AidPreset | typeof MIXED) {
    if (preset === MIXED) return;
    const aids = preset_aids(preset, touch);
    for (const [key] of AID_LIGHTS) guide.set(key, aids[key]);
  }
</script>

<GuideLayout title="How much help?" lede="Aids keep the car tidy while you learn. Turn any of them off later.">
  {#snippet copy()}
    <div class="guide-field">
      <Segmented {options} value={current} label="Driving aids" onchange={pick} />
      <p class="guide-picked">{text}</p>
    </div>
  {/snippet}
  {#snippet visual()}
    <GuideDash aids={guide.prefs} />
    <small class="guide-help">{aid_note(guide.prefs.bindings, guide.device)}</small>
  {/snippet}
</GuideLayout>

<style>
  .guide-field {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
  }

  .guide-picked {
    margin: 0;
    max-width: 52ch;
    font-size: var(--text-lg);
    line-height: 1.45;
    text-wrap: pretty;
  }

  .guide-help {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    text-wrap: pretty;
  }
</style>
