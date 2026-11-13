<script lang="ts">
  import { SteerMode } from "../../car/car";
  import { DEVICES, Device } from "../device";
  import { TouchSteer } from "../prefs";
  import Card from "../ui/Card.svelte";
  import Kbd from "../ui/Kbd.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import GuideLayout from "./GuideLayout.svelte";
  import { STEER, TOUCH_STEER, controls_lede, keymap } from "./guide-text";
  import type { GuideState } from "./guide.svelte";

  interface Props {
    guide: GuideState;
  }

  let { guide }: Props = $props();

  const devices = DEVICES.map(([value, label]) => ({ value, label }));
  const steer = Object.values(SteerMode).map((value) => ({ value, label: STEER[value][0] }));
  const touch = Object.values(TouchSteer).map((value) => ({ value, label: TOUCH_STEER[value][0] }));
  const found = $derived(DEVICES.find(([id]) => id === guide.found)?.[1] ?? "");
  const keys = $derived(keymap(guide.prefs.bindings, guide.device));
</script>

<GuideLayout title="How you drive" lede={controls_lede(guide.prefs, guide.device)}>
  {#snippet copy()}
    <div class="guide-field">
      <Segmented options={devices} value={guide.device} label="Device" onchange={(device) => (guide.device = device)} />
      <small class="guide-help">Found on this device: {found}.</small>
    </div>
    <div class="guide-field">
      {#if guide.device === Device.KEYBOARD}
        <SectionHead eyebrow="Steering feel" />
        <Segmented options={steer} value={guide.prefs.steer_mode} label="Steering feel" onchange={(mode) => guide.set("steer_mode", mode)} />
        <small class="guide-help">{STEER[guide.prefs.steer_mode][1]}</small>
      {:else if guide.device === Device.TOUCH}
        <SectionHead eyebrow="Touch steering" />
        <Segmented options={touch} value={guide.prefs.touch_steer} label="Touch steering" onchange={(mode) => guide.set("touch_steer", mode)} />
        <small class="guide-help">{TOUCH_STEER[guide.prefs.touch_steer][1]}</small>
      {:else}
        <SectionHead eyebrow="Steering feel" />
        <small class="guide-help">The stick steers as far as you push it. Nothing to set.</small>
      {/if}
    </div>
  {/snippet}
  {#snippet visual()}
    <Card variant="well" label="Controls">
      <dl class="guide-keys">
        {#each keys as line (line.what)}
          <dt><Kbd keys={line.keys} /></dt>
          <dd>
            <span class="guide-what">{line.what}</span>
            {#if line.note}<small class="guide-note">{line.note}</small>{/if}
          </dd>
        {/each}
      </dl>
    </Card>
  {/snippet}
</GuideLayout>

<style>
  .guide-field {
    display: grid;
    justify-items: start;
    gap: var(--space-2);
  }

  .guide-help {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    text-wrap: pretty;
  }

  .guide-keys {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-3) var(--space-5);
    margin: 0;
  }

  dt {
    display: flex;
  }

  dd {
    display: grid;
    gap: var(--space-0);
    margin: 0;
  }

  .guide-what {
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.3;
  }

  .guide-note {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
  }

  @media (max-height: 500px) {
    .guide-keys {
      gap: var(--space-2) var(--space-4);
    }

    dd {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
    }
  }
</style>
