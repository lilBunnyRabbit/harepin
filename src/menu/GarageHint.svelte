<script lang="ts" module>
  export type Glyph = "move" | "accept" | "prev" | "next";
</script>

<script lang="ts">
  import Kbd from "./ui/Kbd.svelte";

  interface Props {
    keys: readonly Glyph[];
    label?: string;
  }

  let { keys, label }: Props = $props();

  const GLYPHS: Record<Glyph, [pad: string, keys: string]> = {
    move: ["✥", "Arrows"],
    accept: ["A", "Enter"],
    prev: ["LT", ""],
    next: ["RT", ""],
  };
</script>

<span class="garage-hint">
  {#each keys as key (key)}
    <span class="garage-glyph garage-pad"><Kbd keys={[GLYPHS[key][0]]} /></span>
    {#if GLYPHS[key][1]}<span class="garage-glyph garage-keys"><Kbd keys={[GLYPHS[key][1]]} /></span>{/if}
  {/each}
  {#if label}{label}{/if}
</span>

<style>
  .garage-hint {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    white-space: nowrap;
  }

  .garage-glyph {
    display: inline-flex;
  }

  :global([data-input="pad"]) .garage-keys,
  :global([data-input="keys"]) .garage-pad {
    display: none;
  }

  @media (pointer: coarse) {
    .garage-hint {
      display: none;
    }
  }
</style>
