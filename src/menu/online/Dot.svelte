<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    tone: "good" | "wait" | "bad" | "none";
    children: Snippet;
  }

  let { tone, children }: Props = $props();
</script>

<span class="dot-line" data-tone={tone}>{@render children()}</span>

<style>
  .dot-line {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .dot-line::before {
    content: "";
    flex: none;
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--set-line);
  }

  [data-tone="good"]::before {
    background: var(--success);
  }

  [data-tone="wait"]::before {
    background: var(--warning);
  }

  [data-tone="bad"]::before {
    background: var(--error);
  }
</style>
