<script lang="ts">
  import { SteerMode } from "../../car/car";
  import { keys_text } from "../../hud/bindings";
  import { RumbleLevel } from "../../hud/rumble";
  import { SteerSensitivity, TouchSteer } from "../prefs";
  import type { MenuState } from "../ui/menu-state.svelte";
  import { use_nav } from "./nav.svelte";
  import PadAdvanced from "./PadAdvanced.svelte";
  import ChoiceRow from "./rows/ChoiceRow.svelte";
  import LinkRow from "./rows/LinkRow.svelte";
  import ToggleRow from "./rows/ToggleRow.svelte";
  import { RUMBLE_LABEL, STEER_LABEL, list_help, options } from "./sections";

  interface Props {
    live: MenuState;
  }

  let { live }: Props = $props();

  const nav = use_nav();
  const STEERS = Object.values(SteerMode).map((value) => ({ value, label: STEER_LABEL[value] }));
  const TOUCH = options([
    [TouchSteer.DRAG, "Drag"],
    [TouchSteer.BUTTONS, "Buttons"],
  ]);
  const SENSITIVITY = options([
    [SteerSensitivity.LOW, "Low"],
    [SteerSensitivity.MEDIUM, "Medium"],
    [SteerSensitivity.HIGH, "High"],
    [SteerSensitivity.VERY_HIGH, "Very high"],
  ]);
  const RUMBLE = Object.values(RumbleLevel).map((value) => ({ value, label: RUMBLE_LABEL[value] }));
</script>

<ChoiceRow
  label="Keyboard steering"
  help="Classic: quick to full turn, snaps back. Hold: the wheel stays and centres as you roll. Smooth: a tap nudges, holding builds the turn."
  value={live.prefs.steer_mode}
  options={STEERS}
  onchange={(value) => live.set("steer_mode", value)}
/>
<ToggleRow
  label="Precision steer key"
  help={() => `Hold ${keys_text(live.prefs.bindings.precision) || "the precision key"} for half the keyboard steering.`}
  checked={live.prefs.precision_key}
  onchange={(value) => live.set("precision_key", value)}
/>
<ChoiceRow
  label="Touch steering"
  help="Drag anywhere to steer, or arrow buttons that steer like the keyboard."
  value={live.prefs.touch_steer}
  options={TOUCH}
  onchange={(value) => live.set("touch_steer", value)}
  only="touch"
/>
<ChoiceRow
  label="Steering sensitivity"
  help="Drag steering: how far you drag for full lock. Lower needs a longer drag and steers finer."
  value={live.prefs.steer_sensitivity}
  options={SENSITIVITY}
  onchange={(value) => live.set("steer_sensitivity", value)}
  only="touch"
/>
<ChoiceRow
  label="Controller rumble"
  help="Gamepad vibration as the tyres slide, on rough ground and kerbs, and from landings and hits."
  value={live.prefs.rumble}
  options={RUMBLE}
  onchange={(value) => live.set("rumble", value)}
/>
<PadAdvanced {live} />
<LinkRow label="Change keys and buttons" help="Pick an action, then press its new key or pad button." value="Keyboard and pad" open={() => nav.show("bindings")} />
<LinkRow label="All keys and buttons" help={() => list_help(live.prefs.bindings)} value="Keyboard, pad, touch" open={() => nav.show("keys")} />
