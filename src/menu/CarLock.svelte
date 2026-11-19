<script lang="ts">
  import type { CarId } from "../car/cars";
  import { credits_text } from "../career/wallet";
  import type { Menu } from "./page";
  import { cup_round } from "./series-view";
  import Button from "./ui/Button.svelte";
  import Icon from "./ui/Icon.svelte";
  import Link from "./ui/Link.svelte";

  interface Props {
    menu: Menu;
    car: CarId;
    why: string;
    onround: (id: string) => void;
    /** A body for sale on a frame the player owns: a Buy takes the lock's place. */
    price?: number | null;
    credits?: number;
    onbuy?: () => void;
  }

  let { menu, car, why, onround, price = null, credits = 0, onbuy }: Props = $props();

  const to = $derived(price === null ? cup_round(menu.host.series, car) : null);
  const short = $derived(price === null ? 0 : price - credits);
</script>

<p class="car-lock">
  <span class="car-lock-why"><Icon name="icon-lock" />{why}</span>
  {#if to}<Link chevron onclick={() => onround(to.round)}>Race the {to.cup.name}</Link>{/if}
  {#if price !== null && onbuy}
    <Button variant="primary" size="sm" disabled={short > 0} onclick={onbuy}>{short > 0 ? `Need ${credits_text(short)} more` : `Buy · ${credits_text(price)}`}</Button>
  {/if}
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
