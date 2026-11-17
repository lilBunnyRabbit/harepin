<script lang="ts">
  import { DECALS } from "../car/build";
  import { within } from "../car/car-pick";
  import { livery_of } from "../car/livery";
  import { paint_finish, paint_lab } from "../car/paint";
  import { rating } from "../car/pi";
  import { decal_inks, rgba } from "../theme/palette";
  import DecalTile from "./DecalTile.svelte";
  import type { Garage } from "./garage.svelte";
  import { slot_icon } from "./garage-items";
  import Chip from "./ui/Chip.svelte";
  import Icon from "./ui/Icon.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import TextField from "./ui/TextField.svelte";

  interface Props {
    garage: Garage;
  }

  let { garage }: Props = $props();

  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  const item = $derived(garage.item);
  const shown = $derived(garage.shown);
  const fitted = $derived(item.at(garage.current));
  const livery = $derived(livery_of(shown));
  const fitted_class = $derived(rating(garage.current).class);
  const options = $derived(
    Array.from({ length: item.kind === "number" ? 0 : item.count }, (_, index) => {
      const build = item.with(garage.current, index);
      return {
        index,
        name: item.name(index),
        blurb: item.blurb(index),
        over: item.kind === "part" && !within(rating(build).class, fitted_class),
        swatch: item.kind === "paint" ? rgba(paint_lab(build.paint)) : item.kind === "ink" ? rgba(decal_inks[index]) : null,
        finish: item.kind === "paint" ? paint_finish(build.paint) : null,
        decal: DECALS[build.decal],
      };
    }),
  );

  let list = $state<HTMLElement | null>(null);
  let number = $state("");
  let typing_number = $state(false);

  $effect(() => {
    if (!typing_number) number = item.kind === "number" ? item.name(garage.cursor) : "";
  });

  let last_item = "";
  $effect(() => {
    const id = item.id;
    void garage.cursor;
    if (!list) return;
    const fresh = id !== last_item;
    last_item = id;
    list.querySelector<HTMLElement>("[data-cursor]")?.scrollIntoView({ block: "nearest", behavior: fresh || calm.matches ? "instant" : "smooth" });
  });

  // A mouse previews on hover and fits on click. A finger has no hover: its first tap tries the option on, the second (or the primary) fits it.
  function hover(event: PointerEvent) {
    if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
    const option = event.target.closest<HTMLElement>("[data-option]");
    if (option) garage.preview(Number(option.dataset.option));
  }

  function unhover(event: PointerEvent) {
    if (event.pointerType === "mouse") garage.preview(fitted);
  }

  function pick(event: MouseEvent, index: number) {
    const touch = event instanceof PointerEvent && event.pointerType === "touch";
    if (touch && garage.cursor !== index) garage.preview(index);
    else garage.fit(index);
  }

  function typed(event: Event) {
    const value = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : number;
    const digits = value.replace(/\D/g, "");
    number = digits;
    if (digits) garage.fit(Number(digits));
  }
</script>

<div
  class="garage-parts"
  data-kind={item.kind}
  style:--decal-paint={rgba(paint_lab(shown.paint))}
  style:--decal-ink={livery.ink.getStyle()}
  style:--decal-mark={livery.mark.getStyle()}
  style:--decal-key={livery.key ? livery.key.getStyle() : "transparent"}
>
  {#if item.kind === "number"}
    <div class="garage-stepper" data-cursor={garage.cursor !== fitted ? "" : undefined} bind:this={list}>
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
    <ol class="garage-options" bind:this={list} onpointerover={hover} onpointerleave={unhover}>
      {#each options as option (option.index)}
        <li>
          <button
            type="button"
            class="garage-part"
            data-option={option.index}
            data-cursor={option.index === garage.cursor ? "" : undefined}
            aria-pressed={option.index === fitted}
            aria-label={item.kind === "part" ? undefined : option.name}
            title={item.kind === "part" ? undefined : option.name}
            onclick={(event) => pick(event, option.index)}
          >
            {#if item.kind === "part"}
              <span class="garage-part-icon"><Icon name={slot_icon(item.id)} /></span>
              <span class="garage-part-text">
                <b>{option.name}</b>
                {#if option.blurb}<small>{option.blurb}</small>{/if}
              </span>
              {#if option.index === fitted}
                <Chip inner icon="icon-check">Fitted</Chip>
              {:else if option.over}
                <Chip inner>Over class</Chip>
              {:else}
                <Chip inner>Fits</Chip>
              {/if}
            {:else if item.kind === "decal"}
              <DecalTile decal={option.decal} number={shown.number} />
            {:else}
              <i
                class="garage-swatch"
                data-metal={(option.finish && !option.finish.weave) || undefined}
                data-carbon={option.finish?.weave ? true : undefined}
                style:--swatch={option.swatch}
                style:--swatch-base={option.finish?.weave ? rgba(option.finish.weave.base) : undefined}
              ></i>
            {/if}
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .garage-parts {
    min-width: 0;
  }

  .garage-options {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .garage-options > li {
    display: grid;
    min-width: 0;
  }

  /* :root lifts these over the old `.settings button` reset (0,1,1). */
  :root .garage-part {
    --icon-size: var(--type-h2);
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    min-width: 0;
    height: auto;
    padding: var(--gap-sm) var(--gap-md) var(--gap-sm) var(--gap-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: var(--row);
    color: var(--foreground);
    font: inherit;
    text-align: left;
    white-space: normal;
    cursor: pointer;
  }

  :root .garage-part[data-cursor] {
    background: var(--row-on);
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: calc(var(--mark-w) * -1);
  }

  .garage-part-icon {
    display: grid;
    flex: none;
    place-items: center;
    width: var(--top-h);
    height: var(--top-h);
    border-radius: var(--radius-xs);
    background: var(--fill);
  }

  .garage-part-text {
    display: grid;
    flex: 1;
    gap: var(--gap-xs);
    min-width: 0;
    line-height: 1.25;
  }

  .garage-part-text > b {
    font-weight: 700;
  }

  .garage-part-text > small {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 500;
    text-wrap: pretty;
  }

  [data-kind="paint"] .garage-options,
  [data-kind="ink"] .garage-options,
  [data-kind="decal"] .garage-options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--primary-h), 1fr));
  }

  [data-kind="decal"] .garage-options {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  :root :is([data-kind="paint"], [data-kind="ink"], [data-kind="decal"]) .garage-part {
    justify-content: center;
    padding: var(--gap-sm);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  :root :is([data-kind="paint"], [data-kind="ink"], [data-kind="decal"]) .garage-part[aria-pressed="true"] {
    box-shadow: inset 0 0 0 var(--mark-w) var(--primary);
  }

  .garage-part :global(.garage-decal) {
    width: 100%;
  }

  .garage-stepper {
    display: grid;
    grid-template-columns: auto 8ch auto;
    align-items: center;
    gap: var(--gap-sm);
    width: max-content;
    margin: 0 auto;
    padding: var(--gap-sm);
    border-radius: var(--radius-md);
    background: var(--row);
  }

  .garage-stepper[data-cursor] {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: calc(var(--mark-w) * -1);
  }

  @media (max-height: 500px) {
    :root .garage-part {
      --icon-size: var(--type-h3);
      gap: var(--gap-sm);
    }

    .garage-part-icon {
      width: var(--chip-h);
      height: var(--chip-h);
    }

    .garage-part:not([data-cursor]) .garage-part-text > small {
      display: none;
    }
  }
</style>
