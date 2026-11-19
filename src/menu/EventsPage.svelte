<script lang="ts">
  import { TIERS, current_tier } from "../career/career";
  import { career_total, tier_views } from "../career/career-model";
  import { event_map } from "../career/career-store";
  import { place_of } from "../career/place";
  import { SERIES_PAGE, event_states, standings } from "../career/series";
  import { series_map } from "../career/series-run";
  import { series_blocker, series_front, series_open } from "../career/series-store";
  import { WEEK_STARS } from "../modes/championship";
  import { daily, iso_week, season_days_left, weekly } from "../runs/runs";
  import type { CarPicker } from "./car-pick.svelte";
  import { bare_enter, link_key } from "./drive-picks";
  import { CAREER_PAGE, MODES_PAGE, RUNS_PAGE, type StartTarget } from "./events-view";
  import MenuFrame from "./MenuFrame.svelte";
  import { MenuTab } from "./page";
  import { event_art, next_event, season_kicker, season_lock, season_title } from "./series-view";
  import StartSheet from "./StartSheet.svelte";
  import Card from "./ui/Card.svelte";
  import Chip from "./ui/Chip.svelte";
  import Icon from "./ui/Icon.svelte";
  import KeyLink from "./ui/KeyLink.svelte";
  import PlaceLine from "./ui/PlaceLine.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { preview } from "./widgets";
  import "./events.css";

  const TOP = 4;
  const LINKS: Record<string, string> = { f: MODES_PAGE, v: SERIES_PAGE };

  interface Props extends PageProps {
    picker: CarPicker;
    /** Opens a page whose Back returns here: the start sheet's way to the Garage. */
    open: (id: string) => void;
  }

  let { menu, live, shown, picker, open: open_page }: Props = $props();

  const host = $derived(menu.host);
  const here = $derived({ kind: host.kind, seed: host.seed, levels: host.levels });

  const list = $derived(host.series);
  const ready = $derived(live.live(() => list.length > 0 && list.every((one) => one.ready)));
  const at = $derived(ready ? live.live(() => series_front(list)) : 0);
  const series = $derived(ready ? list[at] : null);
  const season = $derived(live.live(() => series?.season ?? null));
  const progress = $derived(live.live(() => series?.progress ?? null));
  const blocker = $derived(ready && !live.live(() => series_open(list))[at] ? series_blocker(list, at) : null);
  const lock = $derived(blocker && season_lock(blocker));
  const states = $derived(season && progress ? event_states(season, progress) : []);
  const next = $derived(season && progress && !lock ? (season.events[next_event(season, progress, states)] ?? null) : null);
  const round = $derived(season && next ? season.events.indexOf(next) + 1 : 0);
  const table = $derived(season && progress ? standings(season, progress) : []);
  const rows = $derived.by(() => {
    const ranked = table.map((row, i) => ({ ...row, pos: i + 1 }));
    const top = ranked.slice(0, TOP);
    const me = ranked.find((row) => row.you);
    return me && !top.includes(me) ? [...top.slice(0, TOP - 1), me] : top;
  });

  const views = $derived(tier_views(live.stars));
  const total = $derived(career_total(live.stars));
  const now = $derived(TIERS.indexOf(current_tier(live.stars)));

  const runs = $derived(host.runs);
  const today = $derived(live.live(() => runs.today));
  const week = $derived(iso_week(today));
  const run_minis = $derived([
    { name: "Daily", img: preview(daily(today).kind), left: 3 - live.live(() => runs.daily(today)) },
    { name: "Weekly", img: preview(weekly(week).kind), left: WEEK_STARS - live.live(() => runs.weekly(week)) },
    { name: "Random", img: preview("raceway"), left: Math.min(1, live.live(() => runs.free_left)) },
  ]);
  const days = $derived(season_days_left(today));

  let target = $state.raw<StartTarget | null>(null);

  export function back(): boolean {
    if (!target) return false;
    target = null;
    return true;
  }

  function race() {
    if (series && next) target = { kind: "series", series, event: next };
    else menu.show(SERIES_PAGE);
  }

  function key(event: KeyboardEvent) {
    if (!shown || target || event.defaultPrevented) return;
    const to = LINKS[link_key(event) ?? ""];
    if (to) return menu.show(to);
    if (!bare_enter(event)) return;
    event.preventDefault();
    race();
  }
</script>

<svelte:window onkeydown={key} />

{#snippet links()}
  <KeyLink keys={{ key: "V", pad: "Y" }} onclick={() => menu.show(SERIES_PAGE)}>All rounds</KeyLink>
  <KeyLink keys={{ key: "F", pad: "X" }} onclick={() => menu.show(MODES_PAGE)}>Free modes</KeyLink>
{/snippet}

{#snippet primary()}
  <PrimaryAction onclick={race}>{next ? `Race Round ${round}` : "Open the Series"}</PrimaryAction>
{/snippet}

{#snippet series_shot()}
  {#if season}<img class="ev-pic" src={event_art(next ?? season.events[0])} alt="" />{/if}
{/snippet}

{#snippet door_head(name: string, what: string, chip: string)}
  <span class="door-head">
    <span class="door-name">
      <b class="ev-h2">{name}</b>
      <span class="ev-small">{what}</span>
    </span>
    <span class="door-chip"><Chip inner><span class="door-star">★</span>{chip}</Chip></span>
    <span class="door-go"><Icon name="icon-back" flip /></span>
  </span>
{/snippet}

{#if target}
  <StartSheet {menu} {picker} {target} title="Events" {shown} onclose={() => (target = null)} ongarage={() => open_page(MenuTab.GARAGE)} />
{:else}
  <MenuFrame {menu} id={MenuTab.EVENTS} veil={0.5} {links} {primary}>
    <div class="events">
      <Card picture={series_shot} wide focused class="events-series" label="Harepin Series">
        {#if season && progress}
          <div class="ev-head">
            <span class="ev-eyebrow">Harepin Series · {season_kicker(list.map((one) => one.base), list[at].base)} · {season.name}</span>
            <h2 class="ev-h1">{next ? `Round ${round} of ${season.events.length} · ${next.name}` : (lock ?? season_title(season))}</h2>
            {#if next}<PlaceLine place={place_of(series_map(season, next), here)} />{/if}
          </div>
          <ol class="events-rounds" aria-label="Rounds">
            {#each season.events as event (event.id)}
              <li data-state={progress.results[event.id] ? "done" : event === next ? "now" : "ahead"} title={event.name}></li>
            {/each}
          </ol>
          <ol class="events-stand" aria-label="Standings">
            {#each rows as row (row.driver)}
              <li data-you={row.you || undefined}>
                <span class="events-pos">{row.pos}</span>
                <b class="ev-nowrap">{row.you ? "You" : row.name}</b>
                <span class="events-pts">{row.points}</span>
              </li>
            {/each}
          </ol>
        {:else}
          <span class="ev-small">Loading the Series…</span>
        {/if}
      </Card>

      <div class="events-doors">
        <Card class="events-door" flat onclick={() => menu.show(CAREER_PAGE)} label="Career">
          {@render door_head("Career", "Win stars in events to open the next tier", `${total.have} of ${total.max}`)}
          <span class="door-strip">
            {#each views as view (view.tier.id)}
              <span class="door-mini" data-lock={view.state === "locked" ? "" : undefined} data-now={view.index === now ? "" : undefined}>
                <img class="ev-pic" src={preview(event_map(view.final ?? view.tier.events[0]).kind)} alt="" />
                <span class="door-cap">{#if view.state === "locked"}<Icon name="icon-lock" />{/if}<span class="ev-nowrap">{view.tier.name}</span></span>
              </span>
            {/each}
          </span>
        </Card>
        <Card class="events-door" flat onclick={() => menu.show(RUNS_PAGE)} label="Runs">
          {@render door_head("Runs", "A new run every day and every week", `${live.live(() => runs.stars)} · ${days} ${days === 1 ? "day" : "days"} left`)}
          <span class="door-strip">
            {#each run_minis as mini (mini.name)}
              <span class="door-mini">
                <img class="ev-pic" src={mini.img} alt="" />
                <span class="door-cap"><span class="ev-nowrap">{mini.name}</span><b class="door-star">{mini.left > 0 ? `+${mini.left}★` : "Done"}</b></span>
              </span>
            {/each}
          </span>
        </Card>
      </div>
    </div>
  </MenuFrame>
{/if}

<style>
  .events {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .events-rounds {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: var(--gap-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .events-rounds > li {
    height: var(--bar-thick);
    border-radius: var(--radius-full);
    background: var(--fill);
  }

  .events-rounds > [data-state="done"] {
    background: var(--primary);
  }

  .events-rounds > [data-state="now"] {
    background: var(--foreground);
  }

  .events-stand {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--gap-xs) var(--gap);
    margin: 0;
    padding: 0;
    font-size: var(--type-small);
    list-style: none;
  }

  .events-stand > li {
    display: grid;
    grid-template-columns: 1.6em minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--gap-sm);
    padding: var(--gap-xs) var(--gap-md);
    border-radius: var(--radius-xs);
  }

  .events-stand > [data-you] {
    background: var(--row-on);
    color: var(--primary);
  }

  .events-pos,
  .events-pts {
    font-family: var(--font-mono);
  }

  .events-pos {
    color: var(--dim);
  }

  .events-doors {
    display: grid;
    grid-auto-rows: minmax(0, 1fr);
    gap: var(--gap);
    min-width: 0;
    min-height: 0;
  }

  .door-head {
    display: flex;
    align-items: center;
    gap: var(--gap);
    min-width: 0;
  }

  .door-name {
    display: grid;
    flex: 1;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .door-chip {
    display: flex;
    flex: none;
  }

  .door-go {
    --icon-size: 1.4em;
    display: grid;
    flex: none;
    color: var(--dim);
  }

  .door-star {
    color: var(--warning);
    font-weight: 500;
  }

  .door-strip {
    display: grid;
    flex: 1;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: var(--gap-sm);
    min-height: 0;
  }

  .door-mini {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--row);
  }

  .door-mini > img {
    flex: 1;
  }

  .door-mini[data-now] {
    border-color: var(--primary);
  }

  .door-mini[data-lock] > img {
    filter: grayscale(1) brightness(0.55);
  }

  .door-cap {
    --icon-size: 1em;
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 0.35em;
    padding: var(--gap-xs);
    font-size: var(--type-small);
    font-weight: 700;
  }

  .door-mini[data-lock] > .door-cap {
    justify-content: flex-start;
    color: var(--dim);
  }

  @media (max-height: 500px) {
    /* The phone body scrolls, so it clips: the focus ring needs its room inside. */
    .events {
      padding: calc(var(--mark-w) + var(--space-0));
    }

    .events-stand {
      grid-template-columns: 1fr;
    }

    .events-stand > li:nth-child(n + 4),
    .door-chip,
    .door-name > .ev-small,
    .door-cap > :global(svg) {
      display: none;
    }
  }

  /* Portrait: the Series card, then each door, one under the other at their own height; the frame's body scrolls. */
  @media (orientation: portrait) and (max-width: 700px) {
    .events {
      grid-template-columns: minmax(0, 1fr);
      height: auto;
    }

    .events > :global(.events-series > .ui-card-pic) {
      flex: none;
      aspect-ratio: 16 / 9;
    }

    .door-head {
      flex-wrap: wrap;
      gap: var(--gap-sm) var(--gap);
    }

    .door-chip {
      order: 1;
      flex-basis: 100%;
    }

    .door-strip {
      flex: none;
      height: calc(var(--top-h) * 2.5);
    }
  }
</style>
