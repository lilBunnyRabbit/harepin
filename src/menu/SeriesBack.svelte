<script lang="ts">
  import Icon from "./ui/Icon.svelte";

  interface Props {
    onback: () => void;
    label?: string;
  }

  let { onback, label = "Play" }: Props = $props();
</script>

<button type="button" class="sb" onclick={onback} title="Back (Esc)">
  <Icon name="icon-back" />
  <span>{label}</span>
  <kbd>Esc</kbd>
</button>

<style>
  .sb {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    height: var(--control-h);
    padding: 0 var(--space-2) 0 var(--space-1);
    border: 0;
    border-radius: var(--radius-full);
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-md);
    font-weight: 600;
    cursor: pointer;
  }

  .sb:hover {
    color: var(--foreground);
  }

  kbd {
    padding: 0 var(--space-1);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-xs);
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    line-height: 1.6;
  }

  @media (pointer: coarse) {
    kbd {
      display: none;
    }
  }
</style>
