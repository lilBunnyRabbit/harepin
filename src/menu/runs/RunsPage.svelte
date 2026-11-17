<script lang="ts">
  import { place_of, type Place } from "../../career/place";
  import { WEEK_STARS } from "../../modes/championship";
  import { FREE_CAP } from "../../runs/runs-store";
  import { daily, iso_week, new_seed, random, type_of, weekly, type RunPick } from "../../runs/runs";
  import { REPLAYS_PAGE } from "../../replay/saved";
  import { plain_map } from "../../worldgen/kinds/kinds";
  import type { CarPicker } from "../car-pick.svelte";
  import { aim_or_go, bare_enter } from "../drive-picks";
  import { RUNS_PAGE, RUN_BUILD_PAGE, type StartTarget } from "../events-view";
  import MenuFrame from "../MenuFrame.svelte";
  import StartSheet from "../StartSheet.svelte";
  import Card from "../ui/Card.svelte";
  import Icon from "../ui/Icon.svelte";
  import KeyLink from "../ui/KeyLink.svelte";
  import PlaceLine from "../ui/PlaceLine.svelte";
  import PrimaryAction from "../ui/PrimaryAction.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import { preview } from "../widgets";
  import DailyBoard from "./DailyBoard.svelte";
  import SeasonBar from "./SeasonBar.svelte";
  import { world_name } from "./run-text";
  import "../events.css";

  interface Props extends PageProps {
    picker: CarPicker;
  }

  interface RunCard {
    id: "daily" | "weekly" | "random";
    img: string;
    eyebrow: string;
    title: string;
    place: Place | null;
    left: number;
    verb: string;
    pick: () => RunPick;
  }

  let { menu, live, shown, picker }: Props = $props();

  const host = $derived(menu.host);
  const here = $derived({ kind: host.kind, seed: host.seed, levels: host.levels });
  const runs = $derived(host.runs);
  const today = $derived(live.live(() => runs.today));
  const week = $derived(iso_week(today));
  const free_left = $derived(live.live(() => runs.free_left));
  const where = (pick: RunPick) => place_of(plain_map(pick.kind, pick.seed), here);

  const cards = $derived.by<RunCard[]>(() => {
    const day = daily(today);
    const cup = weekly(week);
    const day_name = type_of(day.type).name;
    return [
      { id: "daily", img: preview(day.kind), eyebrow: "Daily · same for everyone", title: day_name, place: where(day), left: 3 - live.live(() => runs.daily(today)), verb: `Run today's ${day_name.toLowerCase()}`, pick: () => day },
      { id: "weekly", img: preview(cup.kind), eyebrow: `Weekly · ${cup.stages?.length ?? 1} stages`, title: `${world_name(cup.kind)} cup`, place: where(cup), left: WEEK_STARS - live.live(() => runs.weekly(week)), verb: `Run the ${world_name(cup.kind)} cup`, pick: () => cup },
      { id: "random", img: preview("raceway"), eyebrow: "Random · any mode", title: "Roll a run", place: null, left: Math.min(1, free_left), verb: "Roll a run", pick: () => random(new_seed()) },
    ];
  });

  let chosen = $state<RunCard["id"]>("daily");
  const card = $derived(cards.find((one) => one.id === chosen) ?? cards[0]);
  let target = $state.raw<StartTarget | null>(null);

  export function back(): boolean {
    if (!target) return false;
    target = null;
    return true;
  }

  const open = (one: RunCard) => (target = { kind: "run", pick: one.pick() });

  function key(event: KeyboardEvent) {
    if (!shown || target || event.defaultPrevented || !bare_enter(event)) return;
    event.preventDefault();
    open(card);
  }
</script>

<svelte:window onkeydown={key} />

{#snippet links()}
  <KeyLink keys={{ touch: "icon-play" }} onclick={() => menu.show(REPLAYS_PAGE)}>Replays</KeyLink>
{/snippet}

{#snippet primary()}
  <PrimaryAction onclick={() => open(card)}>{card.verb}</PrimaryAction>
{/snippet}

{#if target}
  <StartSheet {menu} {picker} {target} eyebrow="Events" title="Runs" {shown} onclose={() => (target = null)} />
{:else}
  <MenuFrame {menu} id={RUNS_PAGE} eyebrow="Events" title="Runs" season={false} veil={0.55} note={`Random and built runs earn up to ${FREE_CAP} ★ a day: ${free_left} left today.`} {links} {primary}>
    <div class="runs">
      <SeasonBar stars={live.live(() => runs.stars)} season={live.live(() => runs.season)} {today} />
      <div class="runs-cards">
        {#each cards as one (one.id)}
          {#snippet shot()}
            <img class="ev-pic" src={one.img} alt="" />
          {/snippet}
          <Card picture={shot} flat class="runs-card" focused={one.id === chosen} selected={one.id === chosen} onclick={(click) => aim_or_go(click, () => (chosen = one.id), () => open(one))} onfocus={() => (chosen = one.id)} label={one.title}>
            <span class="ev-eyebrow">{one.eyebrow}</span>
            <b class="ev-h2 ev-nowrap">{one.title}</b>
            <span class="runs-foot">
              {#if one.place}<PlaceLine place={one.place} />{:else}<span class="ev-small">A new map every roll</span>{/if}
              <b class="runs-gain">{one.left > 0 ? `+${one.left}★` : "Done"}</b>
            </span>
            {#if one.id === "daily"}<DailyBoard {menu} {live} />{/if}
          </Card>
        {/each}
        <Card flat class="runs-build" onclick={() => menu.show(RUN_BUILD_PAGE)} label="Build a run">
          <span class="runs-plus"><Icon name="icon-dice" /></span>
          <b>Build a run</b>
          <span class="ev-small">Map, mode, car</span>
        </Card>
      </div>
    </div>
  </MenuFrame>
{/if}

<style>
  .runs {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .runs-cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 0.7fr);
    gap: var(--gap);
    min-height: 0;
  }

  .runs-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-sm);
    min-width: 0;
  }

  .runs-gain {
    flex: none;
    color: var(--warning);
    font-size: var(--type-small);
    font-weight: 500;
  }

  .runs-cards > :global(.runs-build) {
    align-items: center;
    justify-content: center;
    gap: var(--gap-xs);
    border-style: dashed;
    text-align: center;
  }

  .runs-plus {
    --icon-size: 1.6em;
    display: grid;
    color: var(--dim);
  }

  @media (max-height: 500px) {
    /* The phone body scrolls, so it clips: the focus ring needs its room inside. */
    .runs {
      padding: calc(var(--mark-w) + var(--space-0));
    }

    .runs,
    .runs-cards {
      gap: var(--gap-sm);
    }

    .runs-cards :global(.ui-card-cap) {
      gap: var(--gap-xs);
      padding: var(--gap-sm) var(--gap-md);
    }
  }

  /* Portrait: one run a row, its picture at the side, each at its own height. */
  @media (orientation: portrait) and (max-width: 700px) {
    .runs {
      grid-template-rows: auto auto;
      height: auto;
    }

    .runs-cards {
      grid-template-columns: minmax(0, 1fr);
    }

    .runs-cards > :global(.runs-card) {
      flex-direction: row;
    }

    .runs-cards > :global(.runs-card > .ui-card-pic) {
      flex: 0 0 30%;
    }

    .runs-cards > :global(.runs-card > .ui-card-cap) {
      flex: 1;
      justify-content: center;
    }

    .runs-cards > :global(.runs-build) {
      min-height: calc(var(--row-h) * 2.5);
    }
  }
</style>
