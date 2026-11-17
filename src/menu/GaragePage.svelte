<script lang="ts">
  import { onMount } from "svelte";
  import { CARS } from "../car/cars";
  import { rating } from "../car/pi";
  import type { CarPicker } from "./car-pick.svelte";
  import type { Garage } from "./garage.svelte";
  import GarageBuilds from "./GarageBuilds.svelte";
  import { slot_icon, type Item, type ItemGroup } from "./garage-items";
  import GarageMeters from "./GarageMeters.svelte";
  import { change_own_car } from "./own-car";
  import GarageParts from "./GarageParts.svelte";
  import MenuFrame from "./MenuFrame.svelte";
  import { MenuTab } from "./page";
  import Card from "./ui/Card.svelte";
  import Chip from "./ui/Chip.svelte";
  import ClassBadge from "./ui/ClassBadge.svelte";
  import Icon from "./ui/Icon.svelte";
  import KeyLink from "./ui/KeyLink.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import ScrollArea from "./ui/ScrollArea.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  interface Props extends PageProps {
    garage: Garage;
    picker: CarPicker;
  }

  let { menu, garage, picker, shown }: Props = $props();

  const GROUPS: readonly ItemGroup[] = ["parts", "look"];

  let side = $state<HTMLElement | null>(null);

  const item = $derived(garage.item);
  const car = $derived(CARS[garage.current.car].name);
  const fitted = $derived(item.at(garage.current));
  const tried = $derived(garage.cursor !== fitted);
  const now = $derived(rating(garage.current));
  const next = $derived(rating(garage.shown));
  const groups = $derived(GROUPS.map((group) => garage.items.filter((one) => one.group === group)));
  const action = $derived(item.kind === "part" ? fit_text(item.name(garage.cursor), item.label.toLowerCase()) : `Use ${item.label.toLowerCase()} ${item.name(garage.cursor)}`);

  onMount(() => {
    garage.attach({ sheet: () => side });
    garage.on_pick_car = () => void change_car();
  });

  $effect(() => {
    if (shown) garage.open();
    else garage.close();
  });

  $effect(() => {
    void garage.shown;
    garage.draw();
  });

  export function back(): boolean {
    if (!garage.on_builds) return false;
    garage.toggle_builds();
    return true;
  }

  // "GT kit" on the aero kit is "Fit GT kit", not "Fit GT kit aero kit"; the empty option takes the part off.
  function fit_text(name: string, part: string): string {
    if (name === "None") return `Remove ${part}`;
    return name.toLowerCase().endsWith(part.split(" ").at(-1) ?? part) ? `Fit ${name}` : `Fit ${name} ${part}`;
  }

  const change_car = () => void change_own_car(menu, picker, "Garage");
</script>

{#snippet slot(one: Item)}
  <Chip variant="toggle" icon={slot_icon(one.id)} bind:pressed={() => !garage.on_builds && one.id === item.id, () => garage.select(one)}>{one.label}</Chip>
{/snippet}

{#snippet links()}
  <KeyLink keys={{ key: "C", pad: "Y" }} onclick={change_car}>Change car</KeyLink>
  <KeyLink keys={{ key: "B", pad: "LT" }} onclick={() => garage.toggle_builds()}>{garage.on_builds ? "Parts" : "Builds"}</KeyLink>
{/snippet}

{#snippet primary()}
  {#if !garage.on_builds}
    <PrimaryAction disabled={!tried} onclick={() => garage.fit(garage.cursor)}>{tried ? action : "Fitted"}</PrimaryAction>
  {/if}
{/snippet}

<MenuFrame {menu} id={MenuTab.GARAGE} back_to={garage.on_builds ? "Parts" : undefined} floor {links} {primary}>
  <div class="garage" role="region" aria-label="Garage">
    <div class="garage-slots" data-stage-panel aria-label="Slots">
      {#each groups as group, index (GROUPS[index])}
        <div class="garage-group" role="group" aria-label={GROUPS[index] === "parts" ? "Parts" : "Look"}>
          {#each group as one (one.id)}{@render slot(one)}{/each}
        </div>
      {/each}
    </div>

    <div class="garage-side garage-rail" data-stage-panel bind:this={side}>
      <Card label={garage.on_builds ? "Builds" : item.label}>
        <header class="garage-head">
          <div class="garage-name">
            <span class="garage-eyebrow">{car} · {garage.on_builds ? "Builds" : item.label}</span>
            <b class="garage-title">{garage.on_builds ? "Save, share, load" : item.name(garage.cursor)}</b>
          </div>
          <span class="garage-class">
            <ClassBadge rating={now} size="lg" />
            {#if next.pi !== now.pi}
              <Icon name="icon-back" flip />
              <ClassBadge rating={next} size="lg" />
            {/if}
          </span>
        </header>
        <!-- Keyed: the builds open at their top, not where the parts list was scrolled to. -->
        {#key garage.on_builds}
          <ScrollArea class="garage-scroll">
            {#if garage.on_builds}
              <div class="garage-builds"><GarageBuilds {garage} sheet={side} /></div>
            {:else}
              <GarageParts {garage} />
            {/if}
          </ScrollArea>
        {/key}
        {#if !garage.on_builds}
          <div class="garage-stats"><GarageMeters current={garage.current} shown={garage.shown} /></div>
        {/if}
      </Card>
    </div>
  </div>
</MenuFrame>

<style>
  /* The car stands in the space the two panels leave: the card keeps one size through every slot and the builds, so it never moves. */
  .garage {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 430px;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
    /* A pinch here is the car's zoom; left to the browser it zooms the page and pushes the panels off screen. */
    touch-action: none;
    pointer-events: none;
  }

  .garage-slots {
    --stage-side: bottom;
    display: grid;
    align-self: end;
    justify-self: start;
    gap: var(--gap-md);
    max-width: 560px;
    min-width: 0;
    pointer-events: auto;
  }

  .garage-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm);
  }

  .garage-side {
    --stage-side: right;
    display: grid;
    min-width: 0;
    min-height: 0;
    pointer-events: auto;
  }

  .garage-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap);
    min-width: 0;
  }

  .garage-name {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .garage-name > * {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .garage-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .garage-title {
    font-size: var(--type-h2);
    font-weight: 800;
    line-height: 1.1;
  }

  .garage-class {
    --icon-size: var(--type-body);
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--gap-sm);
    color: var(--dim);
  }

  .garage-side :global(.garage-scroll) {
    flex: 1;
  }

  .garage-builds {
    display: grid;
    gap: var(--pad);
  }

  .garage-stats {
    padding-top: var(--gap-md);
    border-top: 1px solid var(--line);
  }

  @media (max-height: 500px) {
    .garage {
      grid-template-columns: minmax(0, 1fr) 340px;
    }

    .garage-slots {
      display: flex;
      flex-wrap: wrap;
      max-width: 100%;
      gap: var(--gap-sm);
    }

    .garage-group {
      display: contents;
    }

    .garage-stats {
      display: none;
    }
  }

  @media (orientation: portrait) and (max-width: 700px) {
    .garage {
      grid-template: minmax(0, 1fr) auto minmax(0, 1.4fr) / minmax(0, 1fr);
    }

    .garage-slots {
      grid-row: 2;
      max-width: 100%;
    }

    .garage-side {
      --stage-side: bottom;
      grid-row: 3;
    }

    .garage-stats {
      display: none;
    }
  }
</style>
