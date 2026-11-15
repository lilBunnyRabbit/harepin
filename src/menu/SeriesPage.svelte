<script lang="ts">
  import { event_states, season_done, standings, type EventState, type Season, type SeriesProgress } from "../career/series";
  import { series_front, series_open } from "../career/series-store";
  import type { WalletState } from "../career/wallet";
  import { MenuTab } from "./page";
  import SeriesFlow from "./SeriesFlow.svelte";
  import { season_lock, type SeasonTab } from "./series-view";
  import type { PageProps } from "./ui/svelte-page.svelte";

  let { menu, live }: PageProps = $props();

  const list = $derived(menu.host.series ?? []);
  const ready = $derived(live.live(() => list.length > 0 && list.every((one) => one.ready)));
  let picked = $state<number | null>(null);
  const at = $derived(ready ? (picked ?? series_front(list)) : 0);
  const series = $derived(list[at]);
  const progress = $derived<SeriesProgress | null>(live.live(() => (ready ? series.progress : null)));
  // A replay swaps the season for its next round, so it is re-read on refresh like the progress.
  const season = $derived<Season | null>(live.live(() => (ready ? series.season : null)));
  const open = $derived<boolean[]>(live.live(() => (ready ? series_open(list) : [])));
  const seasons = $derived<SeasonTab[]>(live.live(() => (ready ? list.map((one, i) => ({ name: one.base.name, open: open[i], done: season_done(one.season, one.progress) })) : [])));
  const lock = $derived(ready && !open[at] ? season_lock(list[at - 1].base) : null);
  const table = $derived(season && progress ? standings(season, progress) : []);
  const states = $derived<EventState[]>(season && progress ? (lock ? season.events.map(() => "locked") : event_states(season, progress)) : []);
  const done = $derived(season && progress ? season_done(season, progress) : false);
  const wallet = $derived<WalletState | null>(live.live(() => (ready ? series.wallet.state : null)));

  function reset() {
    series?.reset();
    menu.refresh();
  }
</script>

{#if season && progress && wallet}
  <SeriesFlow {season} {progress} {states} {table} {done} {wallet} {seasons} {at} {lock} onseason={(i: number) => (picked = i)} onstart={(id: string) => menu.host.start_series(id)} onback={() => menu.show(MenuTab.PLAY)} onreset={reset} />
{/if}
