<script lang="ts">
  import { MAX_EVENT_STARS, TIERS, current_tier, type CareerEvent } from "../career/career";
  import { tier_views } from "../career/career-model";
  import { event_map, owner_times } from "../career/career-store";
  import { event_place } from "../career/gate";
  import { by_map, place_of } from "../career/place";
  import type { CarPicker } from "./car-pick.svelte";
  import { aim_or_go, bare_enter } from "./drive-picks";
  import { CAREER_PAGE, complete_line, in_map_order, tier_eyebrow, tier_front, tier_line, type StartTarget } from "./events-view";
  import MenuFrame from "./MenuFrame.svelte";
  import StartSheet from "./StartSheet.svelte";
  import Card from "./ui/Card.svelte";
  import Icon from "./ui/Icon.svelte";
  import KeyLink from "./ui/KeyLink.svelte";
  import PlaceLine from "./ui/PlaceLine.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { COPIED_MS, preview } from "./widgets";
  import "./events.css";

  interface Props extends PageProps {
    picker: CarPicker;
    /** `?tune`: every tier plays as open, and the owner copies their own runs' times. */
    tune: boolean;
  }

  let { menu, live, shown, picker, tune }: Props = $props();

  const host = $derived(menu.host);
  const here = $derived({ kind: host.kind, seed: host.seed, levels: host.levels });
  const views = $derived(tier_views(live.stars, tune));
  const now = $derived(TIERS.indexOf(current_tier(live.stars)));
  const complete = $derived(complete_line(views));

  let tier_at = $state<number | null>(null);
  const at = $derived(tier_at ?? now);
  const view = $derived(views[at]);
  const locked = $derived(view.state === "locked");
  const groups = $derived(by_map(view.tier.events, here));
  const order = $derived(in_map_order(groups));
  const maps = (i: number) => by_map(views[i].tier.events, here).length;

  let picked_id = $state<string | null>(null);
  const picked = $derived(order.find((event) => event.id === picked_id) ?? tier_front(live.stars, order, here));
  const place = $derived(place_of(event_map(picked), here));

  let target = $state.raw<StartTarget | null>(null);
  let copied = $state("");

  export function back(): boolean {
    if (!target) return false;
    target = null;
    return true;
  }

  function show_tier(i: number) {
    tier_at = i;
    picked_id = null;
  }

  function open(event: CareerEvent) {
    if (!locked) target = { kind: "event", event };
  }

  function key(event: KeyboardEvent) {
    if (!shown || target || event.defaultPrevented || !bare_enter(event)) return;
    event.preventDefault();
    open(picked);
  }

  async function copy_times() {
    try {
      await navigator.clipboard.writeText(owner_times(host.career));
      copied = "Copied";
    } catch (error) {
      console.warn("career: clipboard refused", error);
      copied = "Copy failed";
    }
    setTimeout(() => (copied = ""), COPIED_MS);
  }
</script>

<svelte:window onkeydown={key} />

{#snippet links()}
  {#if tune}<KeyLink onclick={copy_times}>{copied || "Copy my times"}</KeyLink>{/if}
{/snippet}

{#snippet primary()}
  <PrimaryAction disabled={locked} onclick={() => open(picked)}>{locked ? `Opens at ${view.tier.opens_at} ★` : `Race ${picked.name}`}</PrimaryAction>
{/snippet}

{#if target}
  <StartSheet {menu} {picker} {target} eyebrow="Events" title="Career" {shown} onclose={() => (target = null)} />
{:else}
  <MenuFrame {menu} id={CAREER_PAGE} eyebrow="Events" title="Career" veil={0.5} {links} note={complete ?? `${event_place(picked)} · ${place.here ? "on this map" : `on ${place.name}`}`} {primary}>
    <div class="career">
      <div class="career-tiers">
        {#each views as one (one.tier.id)}
          {#snippet shot()}
            <img class="ev-pic" src={preview(event_map(one.final ?? one.tier.events[0]).kind)} alt="" />
          {/snippet}
          <Card picture={shot} class="career-tier" focused={one.index === at} flat={one.index !== at} selected={one.index === at} onclick={() => show_tier(one.index)} label={one.tier.name}>
            <span class="career-cap" data-lock={one.state === "locked" ? "" : undefined} data-open={one.index === at ? "" : undefined}>
              <span class="ev-eyebrow career-eyebrow">{tier_eyebrow(one)}</span>
              <b class="career-name">{#if one.state === "locked"}<Icon name="icon-lock" />{/if}<span class="ev-nowrap">{one.tier.name}</span></b>
              <span class="ev-small ev-nowrap">{tier_line(one, maps(one.index))}</span>
            </span>
          </Card>
        {/each}
      </div>

      <div class="career-maps" data-lock={locked ? "" : undefined}>
        {#each groups as group (group.code)}
          <section class="career-map" style:flex-grow={group.events.length} aria-label={group.place.here ? "This map" : group.place.name}>
            <PlaceLine place={group.place} />
            <div class="career-events">
              {#each group.events as event (event.id)}
                {@const got = live.stars[event.id] ?? 0}
                <button type="button" class="career-event" aria-pressed={event === picked} onclick={(click) => aim_or_go(click, () => (picked_id = event.id), () => open(event))} onfocus={() => (picked_id = event.id)}>
                  <b class="ev-nowrap">{tune ? `${event.id.toUpperCase()} · ` : ""}{event.name}</b>
                  <span class="ev-stars" aria-label={`${got} of ${MAX_EVENT_STARS} stars`}>{"★".repeat(got)}<i>{"★".repeat(MAX_EVENT_STARS - got)}</i></span>
                </button>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    </div>
  </MenuFrame>
{/if}

<style>
  .career {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .career-tiers {
    display: flex;
    gap: var(--gap);
    min-width: 0;
    min-height: 0;
  }

  .career-tiers > :global(.career-tier) {
    flex: 1 1 0;
  }

  .career-tiers > :global(.career-tier[aria-pressed="true"]) {
    flex-grow: 2.3;
  }

  .career-tiers > :global(.career-tier > .ui-card-cap) {
    padding: var(--gap-md) var(--gap);
  }

  .career-tiers > :global(.career-tier:has([data-lock]) > .ui-card-pic) {
    filter: grayscale(1) brightness(0.55);
  }

  .career-cap {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .career-cap:not([data-open]) > .career-eyebrow {
    display: none;
  }

  .career-name {
    --icon-size: 1em;
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    min-width: 0;
    font-size: var(--type-h3);
    font-weight: 700;
    line-height: 1.2;
  }

  [data-open] > .career-name {
    font-size: var(--type-h2);
    font-weight: 800;
  }

  .career-maps {
    display: flex;
    gap: var(--gap);
    min-width: 0;
  }

  .career-map {
    display: grid;
    flex: 1 1 0;
    gap: var(--gap-sm);
    min-width: 0;
    padding: var(--gap-md);
    border: 1px solid var(--line-strong);
    border-radius: var(--card-radius);
    background: var(--surface);
  }

  .career-events {
    display: flex;
    gap: var(--gap-sm);
    min-width: 0;
  }

  /* :root lifts these over the old `.settings button` reset (0,1,1). */
  :root .career-event {
    display: grid;
    flex: 1 1 0;
    justify-items: start;
    gap: var(--gap-xs);
    min-width: 0;
    height: auto;
    padding: var(--gap-sm) var(--gap-md);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--row);
    color: var(--foreground);
    font: inherit;
    font-size: var(--type-small);
    text-align: left;
    cursor: pointer;
  }

  :root .career-event > b {
    max-width: 100%;
    font-weight: 700;
  }

  :root .career-event:hover {
    border-color: var(--dim);
  }

  :root .career-event[aria-pressed="true"] {
    background: var(--row-on);
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: var(--space-0);
  }

  [data-lock] .career-event {
    color: var(--dim);
  }

  @media (max-height: 500px) {
    /* The phone body scrolls, so it clips: the focus ring needs its room inside. */
    .career {
      padding: calc(var(--mark-w) + var(--space-0));
    }

    .career,
    .career-tiers,
    .career-maps {
      gap: var(--gap-sm);
    }

    .career-tiers > :global(.career-tier > .ui-card-cap) {
      padding: var(--gap-xs) var(--gap-sm);
    }

    .career-cap > .ev-small,
    .career-cap > .career-eyebrow {
      display: none;
    }

    [data-open] > .career-name {
      font-size: var(--type-h3);
    }

    .career-map {
      padding: var(--gap-sm);
    }

    :root .career-event {
      padding: var(--gap-xs) var(--gap-sm);
    }
  }

  /* Portrait: the tiers run as a strip that scrolls sideways, and the picked tier's maps stack under it. */
  @media (orientation: portrait) and (max-width: 700px) {
    .career {
      grid-template-rows: auto auto;
      height: auto;
    }

    .career-tiers {
      gap: var(--gap-md);
      height: calc(var(--top-h) * 4);
      overflow: auto hidden;
      scrollbar-width: none;
    }

    .career-tiers > :global(.career-tier),
    .career-tiers > :global(.career-tier[aria-pressed="true"]) {
      flex: none;
      width: calc(var(--top-h) * 3.5);
      outline-offset: calc(var(--mark-w) * -1);
    }

    .career-maps {
      flex-direction: column;
    }
  }
</style>
