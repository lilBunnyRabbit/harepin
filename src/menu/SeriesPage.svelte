<script lang="ts">
  import { event_states, season_done, standings, type SeriesProgress } from "../career/series";
  import { MenuTab } from "./page";
  import SeriesHero from "./SeriesHero.svelte";
  import SeriesRail from "./SeriesRail.svelte";
  import SeriesTower from "./SeriesTower.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  let { menu, live }: PageProps = $props();

  const VARIANTS = { a: SeriesRail, b: SeriesHero, c: SeriesTower };
  const pick = new URLSearchParams(location.search).get("v");
  const View = VARIANTS[pick === "b" || pick === "c" ? pick : "a"];

  const series = $derived(menu.host.series);
  const progress = $derived<SeriesProgress | null>(live.live(() => (menu.host.series?.ready ? menu.host.series.progress : null)));
  const season = $derived(series?.season ?? null);
  const table = $derived(season && progress ? standings(season, progress) : []);
  const states = $derived(season && progress ? event_states(season, progress) : []);
  const done = $derived(season && progress ? season_done(season, progress) : false);

  function reset() {
    series?.reset();
    menu.refresh();
  }
</script>

{#if season && progress}
  <View {season} {progress} {states} {table} {done} onstart={(id: string) => menu.host.start_series(id)} onback={() => menu.show(MenuTab.PLAY)} onreset={reset} />
{/if}
