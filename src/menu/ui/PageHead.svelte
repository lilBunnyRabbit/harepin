<script lang="ts">
  import Button from "./Button.svelte";

  interface Props {
    title: string;
    onback?: () => void;
    back_label?: string;
  }

  let { title, onback, back_label = "Back" }: Props = $props();
</script>

<header class="ui-page-head">
  {#if onback}<Button variant="quiet" icon="icon-back" title="Back (Esc)" onclick={onback}>{back_label}</Button>{/if}
  <h2 class="ui-title">{title}</h2>
</header>

<style>
  .ui-page-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .ui-page-head > :global(.ui-button) {
    margin-left: calc(-1 * var(--space-4));
  }

  .ui-title {
    margin: 0;
    min-width: 0;
    font-size: var(--text-2xl);
    font-weight: 700;
    line-height: 1.2;
    text-wrap: balance;
  }
</style>
