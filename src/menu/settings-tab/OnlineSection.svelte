<script lang="ts">
  import { country_name, flag, own_country } from "../../net/country";
  import { clean_tint, clean_title } from "../../runs/season";
  import type { Menu } from "../page";
  import { code_text } from "../runs/run-text";
  import type { MenuState } from "../ui/menu-state.svelte";
  import type { Option } from "../ui/types";
  import StepRow from "./rows/StepRow.svelte";
  import ToggleRow from "./rows/ToggleRow.svelte";

  interface Props {
    menu: Menu;
    live: MenuState;
  }

  let { menu, live }: Props = $props();

  const country = own_country();
  const hint = country === null ? "Your time zone matches no country, so nothing is shown." : `Players online see ${flag(country)} ${country_name(country)}, from your time zone.`;

  const NONE = "";
  const runs = $derived(menu.host.runs);
  const owned = $derived(live.live(() => runs.owned));
  const tag = $derived(live.live(() => runs.tag));
  const options = (codes: readonly string[]): Option<string>[] => [{ value: NONE, label: "None" }, ...codes.map((code) => ({ value: code, label: code_text(code) }))];
  const titles = $derived(options(owned.filter((code) => clean_title(code) !== null)));
  const tints = $derived(options(owned.filter((code) => clean_tint(code) !== null)));
  const earn = "Earn more on the Runs season track.";

  function wear(part: "title" | "tint", value: string) {
    runs.wear({ ...tag, [part]: value || undefined });
    menu.refresh();
  }
</script>

{#snippet swatch()}
  {#if tag?.tint}<span class="set-tint" style:--swatch={`var(--${tag.tint})`} aria-hidden="true"></span>{/if}
{/snippet}

<ToggleRow label="Show my country" help={hint} checked={live.prefs.show_country} onchange={(value) => live.set("show_country", value)} />
<StepRow
  label="Name tag title"
  help={titles.length > 1 ? `Players online see it beside your name. ${earn}` : `Season titles show beside your name online. ${earn}`}
  value={tag?.title ?? NONE}
  options={titles}
  onchange={(value) => wear("title", value)}
/>
<StepRow
  label="Name tag tint"
  help={tints.length > 1 ? `Rings your name tag for players online, in their theme's colour. ${earn}` : `A tint rings your name tag online. ${earn}`}
  value={tag?.tint ?? NONE}
  options={tints}
  onchange={(value) => wear("tint", value)}
>
  {@render swatch()}
</StepRow>

<style>
  .set-tint {
    flex: none;
    width: var(--space-4);
    height: var(--space-4);
    border-radius: var(--radius-full);
    background: var(--swatch);
  }
</style>
