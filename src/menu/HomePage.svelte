<script lang="ts">
  import { parse_build } from "../car/build";
  import { CARS } from "../car/cars";
  import { rating } from "../car/pi";
  import { PickId, bare_enter, host_picks, link_key, type DrivePick } from "./drive-picks";
  import { MAPS_PAGE } from "./maps";
  import MenuFrame from "./MenuFrame.svelte";
  import { MenuTab } from "./page";
  import Card from "./ui/Card.svelte";
  import Chip from "./ui/Chip.svelte";
  import ClassBadge from "./ui/ClassBadge.svelte";
  import Icon from "./ui/Icon.svelte";
  import KeyLink from "./ui/KeyLink.svelte";
  import PlaceLine from "./ui/PlaceLine.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { preview } from "./widgets";

  let { menu, live, shown }: PageProps = $props();

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

  function go(pick: DrivePick = at) {
    if (pick.id === PickId.SERIES) host.start_series(pick.target);
    else if (pick.id === PickId.CAREER) host.start_event(pick.target);
    else if (pick.id === PickId.RUN) host.start_run(pick.target);
    else menu.close();
  }

  // Enter and the pad's A click with no pointer behind them (detail 0): they go. A tap or click only aims.
  function press(event: MouseEvent, pick: DrivePick) {
    aimed = pick.id;
    if (event.detail === 0) go(pick);
  }

  function key(event: KeyboardEvent) {
    if (!shown) return;
    if (bare_enter(event)) {
      event.preventDefault();
      return go();
    }
    const link = link_key(event);
    if (link === "c") menu.show(MenuTab.GARAGE);
    else if (link === "m") menu.show(MAPS_PAGE);
  }
</script>

<svelte:window onkeydown={key} />

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
    <KeyLink keys={{ key: "C" }} onclick={() => menu.show(MenuTab.GARAGE)}>Car</KeyLink>
    <KeyLink keys={{ key: "M" }} onclick={() => menu.show(MAPS_PAGE)}>Maps</KeyLink>
  {/snippet}
  {#snippet primary()}
    <PrimaryAction onclick={() => go()}>{at.verb}</PrimaryAction>
  {/snippet}
</MenuFrame>

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

  @media (max-height: 500px) {
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
  }
</style>
