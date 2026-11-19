<script lang="ts">
  import type { PartPick } from "../career/wallet";
  import { credits_text } from "../career/wallet";
  import { pick_label } from "./garage-items";
  import Button from "./ui/Button.svelte";
  import Icon from "./ui/Icon.svelte";

  interface Props {
    parts: readonly PartPick[];
    price: number;
    credits: number;
    onbuy: () => void;
  }

  let { parts, price, credits, onbuy }: Props = $props();

  const short = $derived(price - credits);
</script>

<p class="parts-missing">
  <span class="parts-missing-why"><Icon name="icon-lock" />{parts.map(pick_label).join(", ")} not owned</span>
  <Button variant="primary" size="sm" disabled={short > 0} onclick={onbuy}>{short > 0 ? `Need ${credits_text(short)} more` : `Buy missing parts · ${credits_text(price)}`}</Button>
</p>

<style>
  .parts-missing {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-xs) var(--gap-md);
    margin: 0;
    font-size: var(--type-small);
  }

  .parts-missing-why {
    --icon-size: 1.15em;
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    color: var(--dim);
    font-weight: 700;
  }
</style>
