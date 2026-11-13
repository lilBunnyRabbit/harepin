<script lang="ts">
  import { country_name, flag, own_country } from "../../net/country";
  import type { MenuState } from "../ui/menu-state.svelte";
  import ToggleRow from "./rows/ToggleRow.svelte";

  interface Props {
    live: MenuState;
  }

  let { live }: Props = $props();

  const country = own_country();
  const hint = country === null ? "Your time zone matches no country, so nothing is shown." : `Players online see ${flag(country)} ${country_name(country)}, from your time zone.`;
</script>

<ToggleRow label="Show my country" help={hint} checked={live.prefs.show_country} onchange={(value) => live.set("show_country", value)} />
