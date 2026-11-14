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
  <span class="set-link">
    <span>{value}</span>
    <span class="set-chevron" class:set-open={expanded}><Icon name="icon-back" /></span>
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

  .set-chevron {
    display: flex;
    rotate: 180deg;
    transition: rotate 160ms ease;
  }

  .set-chevron.set-open {
    rotate: -90deg;
  }

  @media (prefers-reduced-motion: reduce) {
    .set-chevron {
      transition: none;
    }
  }
</style>
