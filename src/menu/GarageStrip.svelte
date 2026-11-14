<script lang="ts">
  import { DECALS } from "../car/build";
  import { livery_of } from "../car/livery";
  import { paint_finish, paint_lab } from "../car/paint";
  import { rating } from "../car/pi";
  import { color, decal_inks, rgba } from "../theme/palette";
  import DecalTile from "./DecalTile.svelte";
  import type { Garage } from "./garage.svelte";
  import GarageHint from "./GarageHint.svelte";
  import { slot_icon } from "./garage-items";
  import ClassBadge from "./ui/ClassBadge.svelte";
  import Icon from "./ui/Icon.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import ScrollArea from "./ui/ScrollArea.svelte";
  import TextField from "./ui/TextField.svelte";
  import Tile from "./ui/Tile.svelte";

  interface Props {
    garage: Garage;
  }

  let { garage }: Props = $props();

  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  const item = $derived(garage.item);
  const shown = $derived(garage.shown);
  const fitted = $derived(item.at(garage.current));
  const livery = $derived(livery_of(shown));
  const swapped = $derived(DECALS[shown.decal] !== "none" && !livery.ink.equals(color(decal_inks[shown.ink % decal_inks.length])));
  const options = $derived(
    Array.from({ length: item.kind === "number" ? 0 : item.count }, (_, index) => {
      const build = item.with(garage.current, index);
      return {
        index,
        name: item.name(index),
        blurb: item.blurb(index),
        rating: item.kind === "car" ? rating(build) : null,
        swatch: item.kind === "paint" ? rgba(paint_lab(build.paint)) : item.kind === "ink" ? rgba(decal_inks[index]) : null,
        finish: item.kind === "paint" ? paint_finish(build.paint) : null,
        decal: DECALS[build.decal],
      };
    }),
  );

  let list = $state<HTMLElement | null>(null);
  let number = $state("");
  let typing_number = $state(false);
  // A mouse click leaves the strip still: sliding it would put another card under the pointer and preview that one.
  let pointer = "";

  $effect(() => {
    if (!typing_number) number = item.kind === "number" ? item.name(garage.cursor) : "";
  });

  const card = (selector: string) => list?.querySelector<HTMLElement>(selector);
  const motion = (): ScrollBehavior => (calm.matches ? "instant" : "smooth");

  // A fitted card sits mid-strip, so a phone's narrow strip shows the options either side of it, not only those before.
  let last_key = "";
  let last_centred = 0;
  $effect(() => {
    const key = garage.strip_key;
    const centred = garage.centred;
    void garage.cursor;
    if (!list) return;
    if (key !== last_key) {
      last_key = key;
      last_centred = centred;
      card("[data-fitted]")?.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" });
    } else if (centred !== last_centred) {
      last_centred = centred;
      card("[data-fitted]")?.scrollIntoView({ block: "nearest", inline: "center", behavior: motion() });
    } else card("[data-cursor]")?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: motion() });
  });

  // Hover previews like the pad cursor does; a tap fits straight away through `click`, so touch never sees a preview.
  function hover(event: PointerEvent) {
    if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
    const option = event.target.closest<HTMLElement>("[data-option]");
    if (option) garage.preview(Number(option.dataset.option));
  }

  function unhover(event: PointerEvent) {
    if (event.pointerType === "mouse") garage.preview(fitted);
  }

  function pick(index: number) {
    garage.fit(index, pointer !== "mouse");
    pointer = "";
  }

  function page(dir: -1 | 1) {
    const scroller = list?.closest<HTMLElement>(".ui-scroll");
    scroller?.scrollBy({ left: dir * scroller.clientWidth * 0.8, behavior: motion() });
  }

  function typed(event: Event) {
    const value = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : number;
    const digits = value.replace(/\D/g, "");
    number = digits;
    if (digits) garage.fit(Number(digits));
  }
</script>

<div class="garage-strip-head">
  <Icon name={slot_icon(item.id)} />
  <b>{item.label}</b>
  {#if item.kind !== "number"}<span>· {garage.cursor + 1} of {item.count}</span>{/if}
  {#if (item.kind === "decal" || item.kind === "ink") && swapped}<span>· auto-contrast</span>{/if}
  {#if garage.cursor !== fitted}<GarageHint keys={["accept"]} label="Fit" />{/if}
</div>

<div
  class="garage-strip"
  data-kind={item.kind}
  style:--decal-paint={rgba(paint_lab(shown.paint))}
  style:--decal-ink={livery.ink.getStyle()}
  style:--decal-mark={livery.mark.getStyle()}
  style:--decal-key={livery.key ? livery.key.getStyle() : "transparent"}
>
  <ScrollArea axis="x" label={`${item.label} options`}>
    {#key garage.strip_key}
      {#if item.kind === "number"}
        <div class="garage-stepper" class:garage-cursor={garage.cursor !== fitted} bind:this={list}>
          <IconButton icon="icon-back" label="Number down" onclick={() => garage.step_number(-1)} />
          <TextField
            bind:value={number}
            mono
            center
            inputmode="numeric"
            maxlength={2}
            aria-label="Number"
            oninput={typed}
            onfocus={() => (typing_number = true)}
            onblur={() => (typing_number = false)}
          />
          <IconButton icon="icon-back" flip label="Number up" onclick={() => garage.step_number(1)} />
        </div>
      {:else}
        <ol class="garage-cards" bind:this={list} onpointerover={hover} onpointerleave={unhover}>
          {#each options as option (option.index)}
            <li
              class="garage-option"
              data-option={option.index}
              data-fitted={option.index === fitted || undefined}
              data-cursor={option.index === garage.cursor || undefined}
              onpointerdown={(event) => (pointer = event.pointerType)}
            >
              <Tile title={option.name} meta={option.blurb || undefined} clamp={2} selected={option.index === fitted} onclick={() => pick(option.index)}>
                {#if option.rating}<span class="garage-badge"><ClassBadge rating={option.rating} /></span>{/if}
                {#if option.swatch}<i
                    class="garage-swatch"
                    data-metal={(option.finish && !option.finish.weave) || undefined}
                    data-carbon={option.finish?.weave ? true : undefined}
                    style:--swatch={option.swatch}
                    style:--swatch-base={option.finish?.weave ? rgba(option.finish.weave.base) : undefined}
                  ></i>{/if}
                {#if item.kind === "decal"}<DecalTile decal={option.decal} number={shown.number} />{/if}
              </Tile>
            </li>
          {/each}
        </ol>
      {/if}
    {/key}
  </ScrollArea>
  {#if item.kind !== "number"}
    <IconButton class="garage-arrow garage-prev" icon="icon-back" label="Scroll back" tabindex={-1} onclick={() => page(-1)} />
    <IconButton class="garage-arrow garage-next" icon="icon-back" flip label="Scroll on" tabindex={-1} onclick={() => page(1)} />
  {/if}
</div>

<style>
  .garage-strip-head {
    --icon-size: var(--text-xl);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    /* Sized to the Fit key a preview adds, so hovering a card never changes the band above the strip. */
    height: var(--control-h-sm);
    color: var(--set-dim);
    font-size: var(--text-md);
    font-weight: 600;
  }

  .garage-strip-head > b {
    color: var(--foreground);
  }

  .garage-strip {
    position: relative;
    width: 100%;
    min-width: 0;
    timeline-scope: --garage-strip;
  }

  .garage-strip :global(.ui-scroll) {
    scroll-timeline: --garage-strip inline;
  }

  /* CSS only, like the ScrollArea fade: the strip's scroll timeline shows the arrows and greys the one at an end. With
     nothing to scroll the timeline is inactive, so they stay hidden; a browser without scroll timelines never shows them. */
  .garage-strip :global(.garage-arrow) {
    position: absolute;
    top: 50%;
    z-index: 1;
    translate: 0 -50%;
    visibility: hidden;
    border-color: var(--set-line);
    background: var(--set-raised);
    box-shadow: var(--panel-shadow);
    animation-timing-function: linear;
    animation-fill-mode: both;
    animation-timeline: --garage-strip;
  }

  .garage-strip :global(.garage-prev) {
    left: 0;
    animation-name: garage-arrow-in;
    animation-range: 0 var(--space-6);
  }

  .garage-strip :global(.garage-next) {
    right: 0;
    animation-name: garage-arrow-out;
    animation-range: calc(100% - var(--space-6)) 100%;
  }

  @keyframes garage-arrow-in {
    from {
      visibility: visible;
      opacity: 0.35;
      cursor: default;
    }
    to {
      visibility: visible;
      opacity: 1;
    }
  }

  @keyframes garage-arrow-out {
    from {
      visibility: visible;
      opacity: 1;
    }
    to {
      visibility: visible;
      opacity: 0.35;
      cursor: default;
    }
  }

  /* A finger swipes the strip; the arrows are for a mouse. */
  @media (pointer: coarse) {
    .garage-strip :global(.garage-arrow) {
      display: none;
    }
  }

  .garage-cards {
    display: flex;
    justify-content: safe center;
    gap: var(--space-2);
    margin: 0;
    /* The ends sit clear of the edge fades and the arrows over them. */
    padding: var(--space-1) var(--space-6);
    list-style: none;
    touch-action: pan-x;
  }

  .garage-option {
    display: grid;
    flex: 1 1 0;
    min-width: 128px;
    max-width: 200px;
    border-radius: var(--radius-md);
  }

  /* Inset over the tile's edge: drawn outside it, the ring was clipped top and bottom by the scroller. */
  .garage-option[data-cursor] {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }

  [data-kind="car"] .garage-option {
    flex: 0 0 auto;
    max-width: none;
  }

  [data-kind="paint"] .garage-option,
  [data-kind="ink"] .garage-option {
    flex: 0 0 112px;
    min-width: 0;
  }

  [data-kind="decal"] .garage-option {
    flex: 0 0 128px;
    min-width: 0;
  }

  .garage-badge {
    display: flex;
  }

  .garage-stepper {
    display: grid;
    grid-template-columns: auto 8ch auto;
    align-items: center;
    gap: var(--space-2);
    width: max-content;
    margin: var(--space-1) auto;
    padding: var(--space-2);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-md);
    background: var(--set-raised);
  }

  .garage-stepper.garage-cursor {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  @media (orientation: landscape) and (max-height: 500px), (max-width: 700px) {
    .garage-strip-head {
      display: none;
    }

    .garage-cards {
      padding-inline: var(--space-3);
    }

    .garage-option {
      flex: 0 0 calc((100% - 2 * var(--space-2)) / 2.2);
      min-width: 0;
      max-width: none;
    }
  }

  /* Ends wide enough that an arrow sits over them, never over the first or last card. After the narrow layout, which a
     small desktop window takes too. The far end is a spacer, not padding: an overflowing flex row drops its end padding
     from the scroll width. */
  @media (pointer: fine) {
    .garage-cards {
      padding-inline: calc(var(--control-h) + var(--space-1)) 0;
    }

    .garage-cards::after {
      content: "";
      flex: 0 0 calc(var(--control-h) + var(--space-1) - var(--space-2));
    }
  }
</style>
