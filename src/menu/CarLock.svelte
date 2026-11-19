<script lang="ts">
  import type { CarId } from "../car/cars";
  import type { Menu } from "./page";
  import { cup_round } from "./series-view";
  import Icon from "./ui/Icon.svelte";
  import Link from "./ui/Link.svelte";

  interface Props {
    menu: Menu;
    car: CarId;
    why: string;
    onround: (id: string) => void;
  }

  let { menu, car, why, onround }: Props = $props();

  const to = $derived(cup_round(menu.host.series, car));
</script>

<p class="car-lock">
  <span class="car-lock-why"><Icon name="icon-lock" />{why}</span>
  {#if to}<Link chevron onclick={() => onround(to.round)}>Race the {to.cup.name}</Link>{/if}
</p>

<style>
  .car-lock {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-xs) var(--gap-md);
    margin: 0;
    font-size: var(--type-small);
  }

  .car-lock-why {
    --icon-size: 1.15em;
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    color: var(--error);
    font-weight: 700;
  }
</style>
