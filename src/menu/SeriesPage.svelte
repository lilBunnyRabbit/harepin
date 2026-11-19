<script lang="ts">
  import { SERIES_PAGE, event_states, season_done, standings, type EventState, type Season, type SeriesProgress } from "../career/series";
  import { series_front, series_open } from "../career/series-store";
  import type { WalletState } from "../career/wallet";
  import type { CarPicker } from "./car-pick.svelte";
  import { bare_enter } from "./drive-picks";
  import type { StartTarget } from "./events-view";
  import MenuFrame from "./MenuFrame.svelte";
  import SeriesFlow from "./SeriesFlow.svelte";
  import { season_lock, type SeasonTab } from "./series-view";
  import StartSheet from "./StartSheet.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  interface Props extends PageProps {
    picker: CarPicker;
    /** The round a road result's Next asked for, handed over once: the page opens on its start sheet. */
    asked: () => string | null;
  }

  let { menu, live, shown, picker, asked }: Props = $props();

  const list = $derived(menu.host.series);
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

  let front = $state(0);
  const front_event = $derived(season && states[front] !== "locked" ? (season.events[front] ?? null) : null);
  let target = $state.raw<StartTarget | null>(null);

  export function back(): boolean {
    if (!target) return false;
    target = null;
    return true;
  }

  function start(id: string) {
    const event = series?.event(id);
    if (event) target = { kind: "series", series, event };
  }

  $effect(() => {
    if (!shown || !ready) return;
    const id = asked();
    const one = id === null ? undefined : list.find((each) => each.event(id));
    const event = one?.event(id);
    if (one && event) target = { kind: "series", series: one, event };
  });

  function reset() {
    series?.reset();
    menu.refresh();
  }

  function key(event: KeyboardEvent) {
    if (!shown || target || !front_event || event.defaultPrevented || !bare_enter(event)) return;
    event.preventDefault();
    start(front_event.id);
  }
</script>

<svelte:window onkeydown={key} />

{#snippet primary()}
  <PrimaryAction disabled={!front_event} onclick={() => front_event && start(front_event.id)}>{front_event ? `Race ${front_event.name}` : front >= (season?.events.length ?? 0) ? "Pick a round" : "Locked"}</PrimaryAction>
{/snippet}

{#if target}
  <StartSheet {menu} {picker} {target} eyebrow="Events" title="Harepin Series" {shown} onclose={() => (target = null)} />
{:else}
  <MenuFrame {menu} id={SERIES_PAGE} eyebrow="Events" title="Harepin Series" veil={0.3} bleed {primary}>
    {#if season && progress && wallet}
      <SeriesFlow {shown} {season} {progress} {states} {table} {done} {wallet} {seasons} {at} {lock} onseason={(i: number) => (picked = i)} onstart={start} onfront={(i: number) => (front = i)} onreset={reset} />
    {/if}
  </MenuFrame>
{/if}
