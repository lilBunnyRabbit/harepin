<script lang="ts">
  import type { MenuState } from "../ui/menu-state.svelte";
  import SliderRow from "./rows/SliderRow.svelte";
  import ToggleRow from "./rows/ToggleRow.svelte";

  interface Props {
    live: MenuState;
  }

  let { live }: Props = $props();
</script>

<SliderRow
  label="Master volume"
  help="Engine, tyres, wind and the menu."
  value={live.prefs.volume * 100}
  onchange={(value) => live.set("volume", value / 100)}
  disabled={live.prefs.muted}
/>
<ToggleRow label="Mute" help="Silences everything; the volume stays where it is." checked={live.prefs.muted} onchange={(value) => live.set("muted", value)} />
