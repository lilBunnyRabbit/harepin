<script lang="ts">
  import { parse_build } from "../../car/build";
  import { PickId, bare_enter, host_picks, link_key, type DrivePick } from "../drive-picks";
  import FrameChips from "../FrameChips.svelte";
  import { MenuTab } from "../page";
  import Card from "../ui/Card.svelte";
  import KeyLink from "../ui/KeyLink.svelte";
  import PageFrame from "../ui/PageFrame.svelte";
  import PlaceLine from "../ui/PlaceLine.svelte";
  import PrimaryAction from "../ui/PrimaryAction.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import { preview } from "../widgets";

  let { menu, live, shown }: PageProps = $props();

  const host = $derived(menu.host);
  const build = $derived(parse_build(live.car) ?? host.garage.build);
  const lead = $derived(live.live(() => host_picks(host, live.stars, build))[0]);
  const map = $derived(live.live(() => host.map_name()));
  const tail = $derived([lead.place.here && lead.id !== PickId.ROAM ? map.split(" · ")[0] : null, lead.reasons[0]].filter((part) => part !== null).join(" · "));

  function go(pick: DrivePick) {
    if (pick.id === PickId.SERIES) host.start_series(pick.target);
    else if (pick.id === PickId.CAREER) host.start_event(pick.target);
    else if (pick.id === PickId.RUN) host.start_run(pick.target);
    else menu.close();
  }

  function key(event: KeyboardEvent) {
    if (!shown) return;
    if (bare_enter(event)) {
      event.preventDefault();
      return go(lead);
    }
    const link = link_key(event);
    if (link === "d") menu.close();
    else if (link === "h") menu.show(MenuTab.PLAY);
  }
</script>

<svelte:window onkeydown={key} />

{#snippet chips()}
  <FrameChips {menu} />
{/snippet}

<PageFrame floor {chips} note={lead.note}>
  <div class="title-page">
    <h1 class="title-mark" data-stage-panel>
      <svg aria-hidden="true"><use href="#logo-mark" /></svg>
      <span>Harepin</span>
    </h1>
    <div class="title-continue" data-stage-panel>
      <Card focused label={lead.title} onclick={() => go(lead)}>
        {#snippet picture()}
          <img src={lead.art ?? preview(lead.kind)} alt="" decoding="async" />
        {/snippet}
        <span class="title-eyebrow">{lead.id === PickId.ROAM ? "Continue" : `Continue · ${lead.eyebrow}`}</span>
        <b class="title-name">{lead.title}</b>
        <PlaceLine place={lead.place} {tail} />
      </Card>
    </div>
  </div>

  {#snippet links()}
    {#if lead.id !== PickId.ROAM}<KeyLink keys={{ key: "D" }} onclick={() => menu.close()}>Drive {map.split(" · ")[0]}</KeyLink>{/if}
    <KeyLink keys={{ key: "H" }} onclick={() => menu.show(MenuTab.PLAY)}>Home</KeyLink>
  {/snippet}
  {#snippet primary()}
    <PrimaryAction onclick={() => go(lead)}>{lead.verb}</PrimaryAction>
  {/snippet}
</PageFrame>

<style>
  .title-page {
    --card-w: calc(var(--top-h) * 10);
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--card-w);
    gap: var(--gap);
    height: 100%;
    min-height: 0;
    pointer-events: none;
  }

  /* The wordmark takes the frame's title spot: the top row above the body is empty on this screen. */
  .title-mark {
    --stage-side: top;
    position: absolute;
    top: calc(-1 * (var(--top-h) + var(--gap)));
    left: 0;
    display: flex;
    align-items: center;
    gap: 0.3em;
    margin: 0;
    color: var(--cottontail);
    font-size: var(--display-2);
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0;
  }

  .title-mark svg {
    flex: none;
    width: 1.05em;
    height: 1.05em;
    fill: currentColor;
  }

  .title-continue {
    --stage-side: right;
    display: flex;
    grid-column: 2;
    align-items: flex-end;
    min-width: 0;
  }

  .title-continue > :global(*) {
    width: 100%;
    pointer-events: auto;
  }

  .title-continue :global(.ui-card-pic) {
    flex: none;
    aspect-ratio: 16 / 6;
  }

  .title-eyebrow {
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

  .title-name {
    font-size: var(--type-h2);
    font-weight: 800;
    line-height: 1.1;
    text-wrap: balance;
  }

  /* A phone's body scrolls, which would cut a wordmark standing above it: there it leads the body instead. */
  @media (max-height: 500px) {
    .title-mark {
      position: static;
      align-self: start;
    }
  }

  /* Portrait: the body scrolls here too, and the wordmark is too wide to share the top row with the chips. */
  @media (max-width: 700px) {
    .title-page {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
    }

    .title-mark {
      position: static;
    }

    .title-continue {
      grid-column: 1;
    }
  }
</style>
