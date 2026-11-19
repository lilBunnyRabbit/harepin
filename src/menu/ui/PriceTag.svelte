<script lang="ts">
  import { credits_text } from "../../career/wallet";
  import Icon from "./Icon.svelte";

  interface Props {
    price: number;
  }

  let { price }: Props = $props();
</script>

<span class="ui-price"><Icon name="icon-lock" />{credits_text(price)}</span>

<style>
  .ui-price {
    --icon-size: 1em;
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--gap-xs);
    padding: var(--gap-xs) var(--gap-sm);
    border-radius: var(--radius-full);
    background: var(--surface);
    color: var(--foreground);
    font-family: var(--font-mono);
    font-size: var(--type-small);
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
  }
</style>
