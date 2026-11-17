<script lang="ts">
  import { parse_build } from "../car/build";
  import { CARS } from "../car/cars";
  import { rating } from "../car/pi";
  import type { CarPicker } from "./car-pick.svelte";
  import { PickId, aim_or_go, bare_enter, host_picks, link_key, type DrivePick } from "./drive-picks";
  import { target_of, type StartTarget } from "./events-view";
  import { MAPS_PAGE } from "./maps";
  import MenuFrame from "./MenuFrame.svelte";
  import { change_own_car } from "./own-car";
  import { MenuTab } from "./page";
  import StartSheet from "./StartSheet.svelte";
  import Card from "./ui/Card.svelte";
  import Chip from "./ui/Chip.svelte";
  import ClassBadge from "./ui/ClassBadge.svelte";
  import Icon from "./ui/Icon.svelte";
  import KeyLink from "./ui/KeyLink.svelte";
  import PlaceLine from "./ui/PlaceLine.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { preview } from "./widgets";

  interface Props extends PageProps {
    picker: CarPicker;
  }

  let { menu, live, shown, picker }: Props = $props();

  const host = $derived(menu.host);
  const build = $derived(parse_build(live.car) ?? host.garage.build);
  const picks = $derived(live.live(() => host_picks(host, live.stars, build)));
  const here_name = $derived(live.live(() => host.map_name()));
  let aimed = $state<PickId | null>(null);
  const lead = $derived(picks[0]);
  const at = $derived(picks.find((pick) => pick.id === aimed) ?? lead);
  const others = $derived(picks.slice(1));

  $effect(() => {
    if (!shown) aimed = null;
  });

  const KINDS = { [PickId.SERIES]: "series", [PickId.CAREER]: "event", [PickId.RUN]: "run" } as const;
  let target = $state.raw<StartTarget | null>(null);

  export function back(): boolean {
    if (!target) return false;
    target = null;
    return true;
  }

  function go(pick: DrivePick = at) {
    if (pick.id === PickId.ROAM) return menu.close();
    target = target_of(host, KINDS[pick.id], pick.target);
  }

  const change_car = () => void change_own_car(menu, picker, "Home");

  const press = (click: MouseEvent, pick: DrivePick) => aim_or_go(click, () => (aimed = pick.id), () => go(pick));

  function key(event: KeyboardEvent) {
    if (!shown || target) return;
    if (bare_enter(event)) {
      event.preventDefault();
      return go();
    }
    const link = link_key(event);
    if (link === "c") change_car();
    else if (link === "m") menu.show(MAPS_PAGE);
  }
</script>

<svelte:window onkeydown={key} />

{#if target}
  <StartSheet {menu} {picker} {target} title="Home" {shown} onclose={() => (target = null)} />
{:else}
<MenuFrame {menu} id={MenuTab.PLAY} floor note={at.note}>
  <div class="home">
    <div class="home-bay">
      <Chip><b>{CARS[build.car].name}</b><ClassBadge rating={rating(build)} /></Chip>
    </div>
    <div class="home-picks" data-stage-panel>
      <Card wide focused={at === lead} label={lead.title} onfocus={() => (aimed = lead.id)} onclick={(event) => press(event, lead)}>
        {#snippet picture()}
          <img src={lead.art ?? preview(lead.kind)} alt="" decoding="async" />
        {/snippet}
        <div class="home-head">
          <span class="home-eyebrow">{lead.id === PickId.ROAM ? lead.eyebrow : `Next · ${lead.eyebrow}`}</span>
          <b class="home-title">{lead.title}</b>
          <PlaceLine place={lead.place} tail={lead.place.here && lead.id !== PickId.ROAM ? here_name : undefined} />
        </div>
        <div class="home-reasons">
          {#each lead.reasons as reason (reason)}
            <span><Icon name="icon-check" />{reason}</span>
          {/each}
        </div>
      </Card>
      {#if others.length}
        <div class="home-others">
          {#each others as pick (pick.id)}
            <Card pad="sm" flat focused={at === pick} label={`${pick.eyebrow}: ${pick.title}`} onfocus={() => (aimed = pick.id)} onclick={(event) => press(event, pick)}>
              <span class="home-eyebrow">{pick.eyebrow}</span>
              <b class="home-name">{pick.title}{#if pick.gain}<span class="home-gain">{pick.gain}</span>{/if}</b>
            </Card>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#snippet links()}
    <KeyLink keys={{ key: "C" }} onclick={change_car}>Car</KeyLink>
    <KeyLink keys={{ key: "M" }} onclick={() => menu.show(MAPS_PAGE)}>Maps</KeyLink>
  {/snippet}
  {#snippet primary()}
    <PrimaryAction onclick={() => go()}>{at.verb}</PrimaryAction>
  {/snippet}
</MenuFrame>
{/if}

<style>
  .home {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 47%;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
    pointer-events: none;
  }

  .home-bay {
    display: flex;
    align-items: flex-end;
    min-width: 0;
  }

  .home-bay > :global(*),
  .home-picks > :global(*) {
    pointer-events: auto;
  }

  .home-picks {
    --stage-side: right;
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    min-width: 0;
    min-height: 0;
  }

  .home-picks > :global(.ui-pictured) {
    flex: 1;
  }

  .home-head {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .home-eyebrow {
    overflow: hidden;
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .home-title {
    font-size: var(--type-h1);
    font-weight: 800;
    line-height: 1.1;
    text-wrap: balance;
  }

  .home-reasons {
    --icon-size: 1.15em;
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm) var(--gap);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .home-reasons span {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
    white-space: nowrap;
  }

  .home-reasons :global(svg) {
    flex: none;
    color: var(--primary);
  }

  .home-others {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: var(--gap);
  }

  .home-others :global(.ui-card) {
    gap: var(--gap-xs);
  }

  .home-name {
    overflow: hidden;
    font-size: var(--type-body);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .home-gain {
    margin-left: 0.5em;
    color: var(--accent);
  }

  /* A big screen's ticket would stretch into a slab: it stops at 60% of the body (ui-flows 1.4). */
  @media (min-width: 1600px) {
    .home-picks > :global(.ui-pictured) {
      max-height: 60%;
    }
  }

  @media (max-height: 500px) {
    /* The phone body scrolls, so it clips: the focus ring needs its room inside. */
    .home {
      padding: calc(var(--mark-w) + var(--space-0));
    }

    .home-title {
      font-size: var(--type-h2);
    }
  }

  /* No stage this narrow (`showroom.ts`), so the picks take the row and the car's name stays in the Garage. */
  @media (max-width: 700px) {
    .home {
      grid-template-columns: minmax(0, 1fr);
    }

    .home-bay {
      display: none;
    }

    /* Three tiles in a row leave each too narrow for its name: they stack. */
    .home-others {
      grid-auto-flow: row;
      gap: var(--gap-sm);
    }
  }
</style>
