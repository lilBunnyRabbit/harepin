<script lang="ts">
  import type { CarChoice } from "../car/car-pick";
  import { CARS } from "../car/cars";
  import { CLASS_FLOORS, type CarClass } from "../car/pi";
  import { buy_line, frame_of, lock_line } from "../career/frames";
  import { CAR_PAGE, type CarPicker } from "./car-pick.svelte";
  import CarLock from "./CarLock.svelte";
  import { aim_or_go, bare_enter } from "./drive-picks";
  import { car_facts } from "./car-facts";
  import CarFactsLine from "./CarFactsLine.svelte";
  import CarStill from "./CarStill.svelte";
  import MenuFrame from "./MenuFrame.svelte";
  import Card from "./ui/Card.svelte";
  import ClassBadge from "./ui/ClassBadge.svelte";
  import Icon from "./ui/Icon.svelte";
  import KeyLink from "./ui/KeyLink.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import Progress from "./ui/Progress.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  interface Props extends PageProps {
    picker: CarPicker;
    onround: (id: string) => void;
  }

  let { menu, picker, shown, onround }: Props = $props();

  const rank = (name: CarClass) => CLASS_FLOORS.findIndex(([floor]) => floor === name);

  const ask = $derived(picker.ask);
  const cars = $derived(ask ? [...ask.shelves].sort((a, b) => rank(a.class) - rank(b.class)).flatMap((shelf) => shelf.choices) : []);
  const classes = $derived([...new Set(cars.filter((c) => !c.blocked).map((c) => c.rating.class))]);

  let chosen = $state<string | null>(null);
  let grid = $state<HTMLElement | null>(null);

  const pick = $derived(cars.find((c) => c.code === chosen) ?? null);
  const facts = $derived(pick && car_facts(pick.build));
  const garage = $derived(menu.host.garage);
  // Only when the sale is all that blocks it: a buy then takes the car straight away.
  const for_sale = $derived(pick && pick.blocked === buy_line(pick.build.car) ? garage.car_price(pick.build.car) : null);

  function buy() {
    if (pick && garage.buy_car(pick.build.car)) picker.end(pick.code);
  }

  $effect(() => {
    if (!shown) return picker.end(null);
    const first = cars.find((c) => c.fitted && !c.blocked) ?? cars.find((c) => c.recommended && !c.blocked) ?? cars.find((c) => !c.blocked) ?? null;
    chosen = first?.code ?? null;
  });

  $effect(() => {
    if (!shown || !grid || !ask) return;
    const frame = requestAnimationFrame(() => {
      const card = grid?.querySelector<HTMLElement>("[aria-pressed='true']");
      card?.focus({ preventScroll: true, focusVisible: matchMedia("(pointer: fine)").matches });
      card?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    if (!shown) return;
    picker.on_step = step_class;
    return () => {
      if (picker.on_step === step_class) picker.on_step = null;
    };
  });

  function step_class(by: number) {
    if (!classes.length) return;
    const at = pick ? classes.indexOf(pick.rating.class) : -1;
    const next = classes[(at + by + classes.length) % classes.length];
    const car = cars.find((c) => c.rating.class === next && !c.blocked);
    if (!car) return;
    chosen = car.code;
    const card = grid?.querySelector<HTMLElement>(`[data-code="${CSS.escape(car.code)}"]`);
    card?.focus({ focusVisible: true });
    card?.scrollIntoView({ block: "nearest" });
  }

  function take() {
    if (pick && !pick.blocked) picker.end(pick.code);
  }

  function key(event: KeyboardEvent) {
    if (!shown || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === "KeyQ" || event.code === "KeyE") return step_class(event.code === "KeyQ" ? -1 : 1);
    if (bare_enter(event)) {
      event.preventDefault();
      take();
    }
  }

  function line(c: CarChoice): string {
    if (c.blocked) return c.blocked;
    if (c.own) return "Your car";
    if (c.recommended) return "Best fit";
    // A preset's blurb runs past the card: the card names the car it is built on, the detail panel has the blurb.
    const car = CARS[c.build.car].name;
    return car === c.title ? "" : car;
  }
</script>

<svelte:window onkeydown={key} />

{#snippet links()}
  {#if classes.length > 1}<KeyLink keys={{ key: "Q E", pad: "LB RB" }} onclick={() => step_class(1)}>Next class</KeyLink>{/if}
{/snippet}

{#snippet primary()}
  <PrimaryAction disabled={!pick || pick.blocked !== null} onclick={take}>Take {pick?.title ?? "a car"}</PrimaryAction>
{/snippet}

<MenuFrame {menu} id={CAR_PAGE} back_to={ask?.back} eyebrow={ask ? `${ask.title} · ${ask.limit}` : undefined} title="Choose a car" veil={0.78} {links} note={ask?.note} {primary}>
  <div class="pick">
    <ol class="pick-cars" bind:this={grid} aria-label="Cars">
      {#each cars as c (c.code)}
        <li>
          <button
            type="button"
            class="pick-car"
            data-code={c.code}
            aria-pressed={c.code === chosen}
            aria-disabled={c.blocked !== null}
            onfocus={() => (chosen = c.code)}
            onclick={(click) => aim_or_go(click, () => (chosen = c.code), take)}
          >
            <span class="pick-shot"><CarStill car={c.build.car} build={c.build} /></span>
            <span class="pick-cap">
              <span class="pick-name">
                <b>{c.title}</b>
                <small>{line(c)}</small>
              </span>
              <ClassBadge rating={c.rating} />
            </span>
          </button>
        </li>
      {/each}
    </ol>

    <Card class="pick-detail">
      {#if pick && facts}
        <span class="pick-big"><CarStill car={pick.build.car} build={pick.build} /></span>
        <div class="pick-info">
          <div class="pick-head">
            <span class="pick-eyebrow">{pick.fitted ? "Your car now" : pick.own ? "Your car" : "From your garage"}</span>
            <b class="pick-title">{pick.title}</b>
            {#if pick.sub}<span class="pick-sub">{pick.sub}</span>{/if}
            <span class="pick-facts"><ClassBadge rating={pick.rating} /><CarFactsLine {facts} words /></span>
            {#if for_sale !== null}
              <CarLock {menu} car={pick.build.car} why={pick.blocked ?? ""} {onround} price={for_sale} credits={garage.credits} onbuy={buy} />
            {:else if pick.blocked && pick.blocked === lock_line(frame_of(pick.build.car))}
              <CarLock {menu} car={pick.build.car} why={pick.blocked} {onround} />
            {:else if pick.blocked}<span class="pick-why"><Icon name="icon-lock" />{pick.blocked}</span>{/if}
          </div>
          <div class="pick-meters">
            {#each facts.meters as m (m.key)}
              <b>{m.label}</b>
              <Progress value={m.bar} max={100} label={`${m.label} ${m.value}`} />
            {/each}
          </div>
        </div>
      {/if}
    </Card>
  </div>
</MenuFrame>

<style>
  .pick {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 330px;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  /* A card is as tall as its picture and caption: the picture is 3:2, the shape a car fills, and the grid scrolls past the body. */
  .pick-cars {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-content: start;
    gap: var(--gap);
    min-height: 0;
    margin: 0;
    padding: calc(var(--mark-w) + var(--space-0));
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-snap-type: y proximity;
    scroll-padding: calc(var(--mark-w) + var(--space-0));
    scrollbar-width: none;
    list-style: none;
  }

  .pick-cars > li {
    display: grid;
    min-width: 0;
    scroll-snap-align: start;
  }

  /* :root lifts these over the old `.settings button` reset (0,1,1). */
  :root .pick-car {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    min-width: 0;
    height: auto;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--card-radius);
    background: var(--surface);
    color: var(--foreground);
    font: inherit;
    text-align: left;
    white-space: normal;
    cursor: pointer;
  }

  :root .pick-car:hover {
    border-color: var(--dim);
  }

  :root .pick-car[aria-pressed="true"] {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: var(--space-0);
  }

  :root .pick-car[aria-disabled="true"] > * {
    opacity: 0.5;
  }

  .pick-car[aria-disabled="true"] .pick-shot {
    filter: grayscale(1);
  }

  .pick-shot {
    display: grid;
    flex: none;
    aspect-ratio: 3 / 2;
    padding: var(--gap-sm) var(--gap-sm) 0;
  }

  /* Until its still is drawn a card holds a quiet block, so the grid never jumps. */
  .pick-shot > :global(.still:not([data-ready])) {
    border-radius: var(--radius-sm);
    background: color-mix(in oklch, var(--foreground) 5%, transparent);
  }

  .pick-shot > :global(.still),
  .pick-big > :global(.still) {
    width: 100%;
    height: 100%;
    min-height: 0;
    aspect-ratio: auto;
  }

  .pick-cap {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-sm);
    padding: var(--gap-sm) var(--gap-md);
  }

  .pick-name {
    display: grid;
    min-width: 0;
    line-height: 1.25;
  }

  .pick-name > * {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pick-name > b {
    font-weight: 700;
  }

  .pick-name > small {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 500;
  }

  .pick > :global(.pick-detail) {
    justify-content: flex-start;
  }

  .pick-big {
    display: grid;
    flex: none;
    aspect-ratio: 3 / 2;
  }

  .pick-info {
    display: grid;
    gap: var(--gap);
    min-width: 0;
  }

  .pick-head {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .pick-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .pick-title {
    overflow: hidden;
    font-size: var(--type-h1);
    font-weight: 800;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pick-sub {
    display: -webkit-box;
    overflow: hidden;
    color: var(--dim);
    font-size: var(--type-small);
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .pick-facts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gap-sm) var(--gap-md);
    color: var(--dim);
  }

  .pick-facts > :global(.car-facts) {
    flex-wrap: wrap;
  }

  .pick-why {
    --icon-size: 1.15em;
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    color: var(--error);
    font-size: var(--type-small);
    font-weight: 700;
  }

  .pick-meters {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--gap-sm) var(--gap-md);
    font-size: var(--type-small);
  }

  @media (max-height: 500px) {
    .pick {
      grid-template-columns: minmax(0, 1fr) 200px;
    }

    .pick-big,
    .pick-name > small {
      display: none;
    }

    .pick > :global(.pick-detail) {
      justify-content: center;
    }
  }

  @media (orientation: portrait) and (max-width: 700px) {
    .pick {
      grid-template-columns: minmax(0, 1fr);
    }

    .pick-cars {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .pick > :global(.pick-detail) {
      display: none;
    }
  }
</style>
