<script lang="ts">
  import type { Bindable } from "../../hud/bindings";
  import { AidPreset, preset_aids, preset_of, type Aids } from "../guide-rules";
  import type { SettingKey } from "../prefs";
  import type { MenuState } from "../ui/menu-state.svelte";
  import ChoiceRow from "./rows/ChoiceRow.svelte";
  import ToggleRow from "./rows/ToggleRow.svelte";
  import { options, while_driving } from "./sections";

  interface Props {
    live: MenuState;
  }

  let { live }: Props = $props();

  const PRESETS = options([
    [AidPreset.EASY, "Easy"],
    [AidPreset.BALANCED, "Balanced"],
    [AidPreset.PRO, "Pro"],
  ]);

  const AIDS: [SettingKey & Bindable & keyof Aids, string, string, string, string][] = [
    ["tcs", "Traction control", "Cuts power when the rear wheels spin.", "Cuts power when the wheels spin, for clean launches.", "More wheelspin, easier power slides."],
    ["abs", "Anti-lock brakes", "Keeps steering under hard braking.", "Wheels never lock, so you can steer while braking.", "Hard braking locks the wheels; the car slides on."],
    ["assist", "Steering assist", "Counter-steers a slide for you.", "Counter-steers a slide for you.", "Catching a slide is up to you."],
    ["stability", "Stability", "Damps a slide before it swings into a spin.", "Damps a slide before it turns into a spin.", "A slide can carry the car all the way round."],
    ["auto", "Automatic gearbox", "Shifts for you.", "Shifts up and down for you.", "You shift yourself and pick the gear."],
  ];

  const touch = () => matchMedia("(pointer: coarse)").matches;

  function preset(value: AidPreset) {
    const aids = preset_aids(value, touch());
    for (const key of Object.keys(aids) as (keyof Aids)[]) live.set(key, aids[key]);
  }
</script>

<ChoiceRow
  label="Preset"
  help="Sets the five aids below in one go. Easy looks after grip, brakes and slides. Balanced keeps traction and ABS, so a sharp turn at speed slides. Pro turns everything off (on touch the gearbox stays automatic). Change any toggle for your own mix."
  value={preset_of(live.prefs, touch()) as AidPreset}
  options={PRESETS}
  onchange={preset}
/>
{#each AIDS as [key, label, help, on, off] (key)}
  <ToggleRow {label} help={() => while_driving(live.prefs.bindings, key, help)} checked={live.prefs[key]} onchange={(value) => live.set(key, value)} effect={[on, off]} />
{/each}
<ToggleRow
  label="Ghost car"
  help={() => while_driving(live.prefs.bindings, "ghost", "Your best lap drives beside you.")}
  checked={live.prefs.ghost}
  onchange={(value) => live.set("ghost", value)}
  effect={["Your best lap drives beside you to race against.", "Just you on the road."]}
/>
