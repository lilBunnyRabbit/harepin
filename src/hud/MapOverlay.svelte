<script lang="ts">
  import { MAX_EVENT_STARS } from "../career/career";
  import KeyLink from "../menu/ui/KeyLink.svelte";
  import MapPins from "../menu/ui/MapPins.svelte";
  import PageFrame from "../menu/ui/PageFrame.svelte";
  import PrimaryAction from "../menu/ui/PrimaryAction.svelte";
  import WorldMap from "../menu/WorldMap.svelte";
  import { map_spot } from "../menu/world-map.svelte";
  import { callout_anchor, callout_sides, callout_step, type CalloutStep } from "./map-callouts";
  import type { MapFlag, MapOverlayView } from "./map-overlay.svelte";
  import MapRun from "./MapRun.svelte";

  const VEIL = 0.82;
  const STEPS: Readonly<Record<string, CalloutStep>> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

  interface Props {
    view: MapOverlayView;
  }

  let { view }: Props = $props();

  let dialog: HTMLDialogElement;

  const flags = $derived(view.on_page);
  const flag = $derived(flags.find((one) => one.event.id === view.picked) ?? null);
  const sides = $derived(callout_sides(flags.map((one) => ({ id: one.event.id, x: one.pin.x, z: one.pin.z }))));
  const size = $derived(view.map.status === "ready" ? view.map.size : null);
  const by_id = (id: string) => flags.find((one) => one.event.id === id);
  const columns = $derived(
    (["left", "right"] as const).map((side) => ({
      side,
      slots: sides[side].flatMap((id, row) => {
        const one = by_id(id);
        return one ? [{ flag: one, anchor: callout_anchor(row, sides[side].length) * 100 }] : [];
      }),
    })),
  );
  const note = $derived.by(() => {
    if (view.run) return undefined;
    if (!view.flags.length) return "No flags out on this map right now.";
    if (flag && !flag.event.open) return flag.event.note;
    return "Moves you to the flag. No loading.";
  });

  $effect(() => {
    if (view.shown && !dialog.open) {
      dialog.showModal();
      dialog.focus();
    } else if (!view.shown && dialog.open) dialog.close();
  });

  function go() {
    if (flag?.event.open) view.go(flag.event.id);
  }

  function lead(one: MapFlag, anchor: number, side: "left" | "right"): string {
    if (size === null) return "";
    const [u, v] = map_spot(size, one.pin.x, one.pin.z);
    return `${side === "left" ? 0 : 100},${anchor} ${(u * 100).toFixed(2)},${(v * 100).toFixed(2)}`;
  }

  function key(event: KeyboardEvent) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (view.close_keys.includes(event.code)) {
      event.preventDefault();
      return view.close();
    }
    if (view.run) return;
    if (event.code === "KeyO") {
      event.preventDefault();
      return view.other_maps();
    }
    if (event.code === "KeyF") {
      event.preventDefault();
      return view.more();
    }
    if (event.key === "Enter" && !(event.target instanceof Element && event.target.closest("button"))) {
      event.preventDefault();
      return go();
    }
    const step = STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    view.picked = callout_step(sides, view.picked, step);
  }
</script>

<dialog bind:this={dialog} class="road-map" tabindex="-1" aria-label={view.run ? "Route map" : "Road map"} onclose={() => view.close()} onkeydown={key}>
  {#if view.shown}
    <PageFrame eyebrow={view.name} title={view.run ? "Route map" : "Road map"} veil={VEIL} back={{ to: view.run ? "Race" : "Road", go: () => view.close() }} {note}>
      <div class="rmap" data-run={view.run ? "" : undefined} style:--map-edge={view.map.edge}>
        {#each columns as column (column.side)}
          <ol class="rmap-side" data-side={column.side} aria-label={`Flags on the ${column.side}`}>
            {#each column.slots as slot (slot.flag.event.id)}
              {@const one = slot.flag}
              {@const on = one.event.id === view.picked}
              <li class="rmap-slot" data-picked={on ? "" : undefined}>
                <button type="button" class="rmap-callout" tabindex="-1" aria-pressed={on} onclick={() => (view.picked = one.event.id)} ondblclick={go}>
                  <span class="rmap-what">
                    <span class="rmap-eyebrow">{one.event.eyebrow}</span>
                    <b>{one.event.title}</b>
                  </span>
                  <span class="rmap-facts">
                    <b class="rmap-far">{one.distance}</b>
                    {#if one.next}
                      <span class="rmap-next">Next up</span>
                    {:else if !one.event.open}
                      <span class="rmap-shut">Locked</span>
                    {:else}
                      <span class="rmap-stars" role="img" aria-label={`${one.event.stars} of ${MAX_EVENT_STARS} stars`}><b>{"★".repeat(one.event.stars)}</b>{"★".repeat(MAX_EVENT_STARS - one.event.stars)}</span>
                    {/if}
                  </span>
                </button>
                <i class="rmap-rule"></i>
              </li>
            {/each}
          </ol>
        {/each}

        <div class="rmap-map">
          <div class="rmap-paint"><WorldMap map={view.map} label={`Map of ${view.name}`} /></div>
          {#if view.run}<MapRun {size} run={view.run} />{/if}
          {#if size !== null}
            <svg class="rmap-leads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {#each columns as column (column.side)}
                {#each column.slots as slot (slot.flag.event.id)}
                  <polyline class="rmap-case" points={lead(slot.flag, slot.anchor, column.side)} />
                {/each}
              {/each}
              {#each columns as column (column.side)}
                {#each column.slots as slot (slot.flag.event.id)}
                  <polyline class="rmap-lead" data-picked={slot.flag.event.id === view.picked ? "" : undefined} points={lead(slot.flag, slot.anchor, column.side)} />
                {/each}
              {/each}
            </svg>
          {/if}
          <MapPins {size} pins={flags.map((one) => one.pin)} picked={view.picked} you={view.you} onpick={(id) => (view.picked = id)} />
        </div>
      </div>

      {#snippet links()}
        {#if !view.run}
          <KeyLink keys={{ key: "O" }} onclick={() => view.other_maps()}>Other maps{view.away ? ` · ${view.away.count} open` : ""}</KeyLink>
          {#if view.pages > 1}<KeyLink keys={{ key: "F" }} onclick={() => view.more()}>More flags · {view.page + 1}/{view.pages}</KeyLink>{/if}
        {/if}
      {/snippet}
      {#snippet primary()}
        {#if flag}<PrimaryAction disabled={!flag.event.open} onclick={go}>Go to flag</PrimaryAction>{/if}
      {/snippet}
    </PageFrame>
  {/if}
</dialog>

<style>
  .road-map {
    box-sizing: border-box;
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--foreground);
    font-family: var(--font-sans);
    user-select: none;
  }

  :global(body:has(.road-map[open]) > :not(#app, .map-overlay-host)) {
    visibility: hidden;
  }

  .road-map:focus {
    outline: none;
  }

  .road-map::backdrop {
    background: none;
  }

  /* The map is a square as tall as the card, narrower only when the callouts would run out of room: each side's rows
     then span exactly the map's height, so a callout's row meets the map's edge at a known share of it. The card
     carries the map's own edge colour, so the sea runs on under the callouts. */
  .rmap {
    --callout-w: 17rem;
    --callout-max: var(--callout-w);
    --callout-h: 4.25rem;
    --jog: var(--inset);
    container-type: size;
    display: grid;
    grid-template: "left map right" auto / minmax(0, 1fr) auto minmax(0, 1fr);
    align-content: center;
    height: 100%;
    border: 1px solid var(--line-strong);
    border-radius: var(--card-radius);
    background: var(--map-edge, var(--surface));
    box-shadow: var(--shadow);
    overflow: clip;
  }

  .rmap-map {
    grid-area: map;
    position: relative;
    width: min(100cqh, 100cqw - 2 * (var(--callout-w) + var(--jog) + var(--pad)));
    aspect-ratio: 1;
  }

  .rmap[data-run] .rmap-map {
    width: min(100cqh, 100cqw);
  }

  .rmap-paint {
    position: absolute;
    inset: 0;
  }

  .rmap-side {
    display: grid;
    grid-auto-rows: 1fr;
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rmap-side[data-side="left"] {
    grid-area: left;
    padding-left: var(--pad);
  }

  .rmap-side[data-side="right"] {
    grid-area: right;
    padding-right: var(--pad);
  }

  .rmap-slot {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  [data-side="right"] .rmap-slot {
    flex-direction: row-reverse;
  }

  .rmap-rule {
    flex: 1 0 var(--jog);
    height: 2px;
    background: var(--foreground);
    box-shadow: 0 0 0 2px var(--deep);
  }

  [data-picked] > .rmap-rule {
    height: 3px;
    background: var(--cottontail);
  }

  /* :root lifts this over the base button rules. */
  :root .rmap-callout {
    display: flex;
    flex: 0 1 var(--callout-max);
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-md);
    min-width: var(--callout-w);
    height: var(--callout-h);
    padding: var(--gap-md) var(--gap);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--row);
    color: var(--foreground);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  :root .rmap-callout:hover {
    border-color: var(--dim);
  }

  :root .rmap-callout[aria-pressed="true"] {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: calc(var(--mark-w) * -1);
    background: var(--row-on);
  }

  .rmap-what {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .rmap-what b,
  .rmap-eyebrow {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rmap-what b {
    font-weight: 700;
    line-height: 1.2;
  }

  .rmap-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .rmap-facts {
    display: grid;
    flex: none;
    justify-items: end;
    gap: var(--gap-xs);
    font-size: var(--type-small);
    white-space: nowrap;
  }

  .rmap-far {
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .rmap-next {
    color: var(--cottontail);
    font-weight: 700;
  }

  .rmap-shut,
  .rmap-stars {
    color: var(--dim);
  }

  .rmap-stars b {
    color: var(--cottontail);
    font-weight: inherit;
  }

  .rmap-leads {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    fill: none;
    stroke-linecap: round;
    pointer-events: none;
  }

  .rmap-case,
  .rmap-lead {
    vector-effect: non-scaling-stroke;
  }

  .rmap-case {
    stroke: var(--deep);
    stroke-width: 6px;
  }

  .rmap-lead {
    stroke: var(--foreground);
    stroke-width: 2px;
  }

  .rmap-lead[data-picked] {
    stroke: var(--cottontail);
    stroke-width: 3px;
  }

  @media (max-height: 500px) {
    .rmap {
      /* The map gives way to the narrow width only; a callout takes the room a wide phone leaves beside it. */
      --callout-w: 12.75rem;
      --callout-max: 17rem;
      --callout-h: 3.125rem;
    }

    :root .rmap-callout {
      height: auto;
      min-height: var(--callout-h);
      padding: var(--gap-sm) var(--gap-md);
    }

    /* On a phone too narrow to widen the callout, a long eyebrow takes a second line. */
    .rmap-eyebrow {
      white-space: normal;
    }
  }
</style>
