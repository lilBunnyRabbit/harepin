<script lang="ts">
  import { event_states, season_done, standings, type SeriesProgress } from "../career/series";
  import { MenuTab } from "./page";
  import SeriesClimb from "./SeriesClimb.svelte";
  import SeriesDeck from "./SeriesDeck.svelte";
  import { DeckLayout } from "./series-deck";
  import SeriesHero from "./SeriesHero.svelte";
  import SeriesIslands from "./SeriesIslands.svelte";
  import SeriesRail from "./SeriesRail.svelte";
  import SeriesRoad from "./SeriesRoad.svelte";
  import SeriesTower from "./SeriesTower.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  let { menu, live }: PageProps = $props();

  const VARIANTS: Record<string, typeof SeriesRail> = { a: SeriesRail, b: SeriesHero, c: SeriesTower, d: SeriesRoad, e: SeriesIslands, f: SeriesClimb };
  const DECKS: Record<string, DeckLayout> = { g: DeckLayout.ROAD, h: DeckLayout.PILE, i: DeckLayout.RING, j: DeckLayout.LANE, k: DeckLayout.ARC };
  const pick = new URLSearchParams(location.search).get("v") ?? "g";
  const deck = DECKS[pick] ?? null;
  const View = VARIANTS[pick] ?? SeriesRoad;

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
  {#if deck}
    <SeriesDeck layout={deck} {season} {progress} {states} {table} {done} onstart={(id: string) => menu.host.start_series(id)} onback={() => menu.show(MenuTab.PLAY)} onreset={reset} />
  {:else}
    <View {season} {progress} {states} {table} {done} onstart={(id: string) => menu.host.start_series(id)} onback={() => menu.show(MenuTab.PLAY)} onreset={reset} />
  {/if}
{/if}
