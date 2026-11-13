<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    kind?: "tag" | "count";
    tone?: "neutral" | "primary" | "accent" | "success" | "info";
    children: Snippet;
  }

  let { kind = "tag", tone = "neutral", children }: Props = $props();
</script>

<span class="ui-badge" data-kind={kind} data-tone={tone}>{@render children()}</span>

<style>
  .ui-badge {
    display: inline-flex;
    flex: none;
    align-items: center;
    padding: var(--space-0) var(--space-2);
    border-radius: var(--radius-full);
    background: var(--set-raised);
    color: var(--foreground);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
    white-space: nowrap;
  }

  [data-kind="count"] {
    justify-content: center;
    min-width: calc(var(--text-xs) * 1.2 + 2 * var(--space-0));
    padding: var(--space-0) var(--space-1);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
  }

  [data-tone="primary"] {
    background: var(--primary);
    color: var(--on-primary);
  }

  [data-tone="accent"] {
    background: var(--accent);
    color: var(--on-accent);
  }

  [data-tone="success"] {
    background: color-mix(in oklch, var(--success) 24%, transparent);
    color: var(--success);
  }

  [data-tone="info"] {
    background: color-mix(in oklch, var(--info) 24%, transparent);
    color: var(--info);
  }
</style>
