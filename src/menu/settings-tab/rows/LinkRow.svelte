<script lang="ts">
  import Icon from "../../ui/Icon.svelte";
  import SettingRow from "../SettingRow.svelte";

  interface Props {
    label: string;
    help: string | (() => string);
    value: string;
    open: () => void;
    hidden?: boolean;
    expanded?: boolean;
  }

  let { label, help, value, open, hidden = false, expanded }: Props = $props();
</script>

<SettingRow {label} {help} {hidden} {expanded} accept={open}>
  <span class="set-link" class:set-open={expanded}>
    <span>{value}</span>
    <Icon name="icon-back" flip />
  </span>
</SettingRow>

<style>
  .set-link {
    --icon-size: var(--text-xl);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--set-dim);
    font-size: var(--text-md);
    text-align: right;
  }

  .set-link :global(.ui-icon) {
    transition: rotate 160ms ease;
  }

  .set-open :global(.ui-icon) {
    rotate: -90deg;
  }

  @media (prefers-reduced-motion: reduce) {
    .set-link :global(.ui-icon) {
      transition: none;
    }
  }
</style>
