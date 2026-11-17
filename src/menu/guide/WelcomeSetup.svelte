<script lang="ts">
  import { SteerMode } from "../../car/car";
  import { show_theme } from "../../theme/palette";
  import { choose_theme, current_theme, find_theme } from "../../theme/theme";
  import { DEVICES, Device, detect_device } from "../device";
  import { AidPreset, preset_aids, preset_of } from "../guide-rules";
  import { TouchSteer } from "../prefs";
  import Card from "../ui/Card.svelte";
  import Chip from "../ui/Chip.svelte";
  import Kbd from "../ui/Kbd.svelte";
  import type { MenuState } from "../ui/menu-state.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import { AID_LIGHTS, LOOKS, PRESETS, STEER, SWATCHES, TOUCH_STEER, keymap, pro_text } from "./guide-text";

  interface Props {
    live: MenuState;
  }

  let { live }: Props = $props();

  let theme = $state(current_theme());
  let device = $state<Device>(detect_device());

  const devices = DEVICES.map(([value, label]) => ({ value, label }));
  const presets = PRESETS.map(([value, label]) => ({ value, label }));
  const steer = Object.values(SteerMode).map((value) => ({ value, label: STEER[value][0] }));
  const touch_steer = Object.values(TouchSteer).map((value) => ({ value, label: TOUCH_STEER[value][0] }));

  const prefs = $derived(live.prefs);
  const touch = $derived(device === Device.TOUCH);
  const preset = $derived(preset_of(prefs, touch));
  const preset_text = $derived(preset === null ? "Your own mix of aids." : preset === AidPreset.PRO ? pro_text(prefs.bindings, device) : (PRESETS.find(([id]) => id === preset)?.[2] ?? ""));
  const keys = $derived(keymap(prefs.bindings, device));

  // The menu and the HUD take the colours now; the world's own take them on the load that follows Drive.
  function look(name: string) {
    theme = name;
    choose_theme(name);
    show_theme(name);
  }

  function help(next: AidPreset) {
    const aids = preset_aids(next, touch);
    for (const [key] of AID_LIGHTS) live.set(key, aids[key]);
  }
</script>

<div class="wel-setup">
  <Card label="Theme">
    <div class="wel-head">
      <b class="wel-h3">Theme</b>
      <span class="wel-help">Colours for the menu, the HUD and the whole world.</span>
    </div>
    <div class="wel-looks" role="radiogroup" aria-label="Theme">
      {#each LOOKS as name (name)}
        {@const colours = find_theme(name)}
        <button type="button" class="wel-look" role="radio" aria-checked={name === theme} style:background={colours?.background} style:color={colours?.foreground} onclick={() => look(name)}>
          <span class="wel-look-name">{name}</span>
          <span class="wel-swatches">
            {#each SWATCHES as token (token)}<i style:background={colours?.[token]}></i>{/each}
          </span>
        </button>
      {/each}
    </div>
  </Card>
  <Card label="Handling">
    <div class="wel-head">
      <b class="wel-h3">Handling</b>
      <span class="wel-help">How much the car helps while you learn it.</span>
    </div>
    <div class="wel-pick">
      <Segmented options={presets} value={preset} label="Driving aids" onchange={help} />
      <div class="wel-aids" aria-label="Aids on">
        {#each AID_LIGHTS as [key, label] (key)}
          <Chip inner tone={prefs[key] ? "live" : "idle"}>{label}</Chip>
        {/each}
      </div>
      <span class="wel-help">{preset_text}</span>
    </div>
    <div class="wel-pick">
      <span class="wel-eyebrow">{touch ? "Touch steering" : "Steering feel"}</span>
      {#if device === Device.KEYBOARD}
        <Segmented options={steer} value={prefs.steer_mode} label="Steering feel" onchange={(mode) => live.set("steer_mode", mode)} />
        <span class="wel-help">{STEER[prefs.steer_mode][1]}</span>
      {:else if touch}
        <Segmented options={touch_steer} value={prefs.touch_steer} label="Touch steering" onchange={(mode) => live.set("touch_steer", mode)} />
        <span class="wel-help">{TOUCH_STEER[prefs.touch_steer][1]}</span>
      {:else}
        <span class="wel-help">The stick steers as far as you push it. Nothing to set.</span>
      {/if}
    </div>
  </Card>
  <Card label="Controls">
    <div class="wel-head">
      <b class="wel-h3">Controls</b>
      <Segmented options={devices} value={device} label="Device" onchange={(next) => (device = next)} />
    </div>
    <dl class="wel-keys">
      {#each keys as line (line.what)}
        <dt><Kbd keys={line.keys} /></dt>
        <dd>
          <span class="wel-what">{line.what}</span>
          {#if line.note}<span class="wel-help">{line.note}</span>{/if}
        </dd>
      {/each}
    </dl>
  </Card>
</div>

<style>
  .wel-setup {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .wel-setup > :global(.ui-card) {
    gap: var(--pad);
    overflow-y: auto;
    scrollbar-width: none;
  }

  .wel-head,
  .wel-pick {
    display: grid;
    justify-items: start;
    gap: var(--gap-sm);
    min-width: 0;
  }

  .wel-h3 {
    font-size: var(--type-h3);
    font-weight: 800;
    line-height: 1.15;
  }

  .wel-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .wel-help {
    color: var(--dim);
    font-size: var(--type-small);
    line-height: 1.4;
    text-wrap: pretty;
  }

  .wel-looks {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: minmax(var(--top-h), 1fr);
    gap: var(--gap-sm);
    min-height: 0;
  }

  .wel-look {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--gap-sm);
    height: auto;
    min-width: 0;
    padding: var(--gap-md);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    font: inherit;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }

  .wel-look:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  .wel-look[aria-checked="true"],
  .wel-look:focus-visible {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: var(--space-0);
  }

  .wel-look-name {
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wel-swatches {
    display: flex;
    gap: var(--gap-xs);
  }

  .wel-swatches i {
    width: 1em;
    height: 1em;
    border-radius: var(--radius-full);
  }

  .wel-aids {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm);
  }

  .wel-keys {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--gap-md) var(--gap);
    margin: 0;
  }

  dt {
    display: flex;
  }

  dd {
    display: grid;
    gap: var(--gap-xs);
    margin: 0;
  }

  .wel-what {
    font-weight: 700;
  }

  @media (max-height: 500px) {
    .wel-setup {
      height: auto;
      min-height: 100%;
    }

    .wel-setup > :global(.ui-card) {
      overflow: visible;
    }

    dd {
      display: flex;
      align-items: baseline;
      gap: var(--gap-sm);
    }
  }
</style>
