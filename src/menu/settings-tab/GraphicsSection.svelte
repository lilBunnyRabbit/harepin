<script lang="ts">
  import type { Menu } from "../page";
  import { QualityMode } from "../prefs";
  import type { MenuState } from "../ui/menu-state.svelte";
  import ChoiceRow from "./rows/ChoiceRow.svelte";
  import InfoRow from "./rows/InfoRow.svelte";
  import { TIER_LABEL, options } from "./sections";

  interface Props {
    menu: Menu;
    live: MenuState;
  }

  let { menu, live }: Props = $props();

  const QUALITIES = options([
    [QualityMode.AUTO, "Auto"],
    [QualityMode.HIGH, "High"],
    [QualityMode.MEDIUM, "Medium"],
    [QualityMode.LOW, "Low"],
  ]);

  const status = $derived(live.live(() => menu.host.quality_status()));
  const tier = $derived(TIER_LABEL[status.tier]);
  const shadows = $derived(status.shadow_size ? `${status.shadow_size}px` : "off");
  const bloom = $derived(status.bloom ? "on" : "off");
</script>

{#snippet running()}
  <div class="set-status">
    <span class="set-status-head">{live.prefs.quality === QualityMode.AUTO ? `Auto is running ${tier}` : `Fixed at ${tier}`}</span>
    {#each [["scale", `${status.ratio.toFixed(2)}x`], ["shadows", shadows], ["bloom", bloom]] as [name, value] (name)}
      <span class="set-stat">{name} <b>{value}</b></span>
    {/each}
  </div>
{/snippet}

<ChoiceRow
  label="Quality"
  help="How much the game draws. Auto steps down when the frame rate drops."
  value={live.prefs.quality}
  options={QUALITIES}
  onchange={(value) => live.set("quality", value)}
  visual={running}
/>
<InfoRow
  label="Running now"
  help="What the game draws at this moment; Auto changes it as the frame rate moves."
  value={`${tier} · ${status.ratio.toFixed(2)}x · shadows ${shadows} · bloom ${bloom}`}
  visual={running}
/>

<style>
  .set-status {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--set-well);
    font-size: var(--text-md);
    font-weight: 600;
  }

  .set-status-head {
    flex-basis: 100%;
  }

  .set-stat {
    display: inline-flex;
    gap: var(--space-2);
    color: var(--set-dim);
    font-weight: 400;
  }

  .set-stat b {
    color: var(--foreground);
    font-family: var(--font-mono);
    font-weight: 700;
  }
</style>
