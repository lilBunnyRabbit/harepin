<script lang="ts">
  import type { Aids } from "../guide-rules";
  import { AID_LIGHTS } from "./guide-text";

  interface Props {
    aids: Aids;
  }

  let { aids }: Props = $props();
</script>

<span class="guide-lights">
  {#each AID_LIGHTS as [key, label] (key)}<i class:guide-on={aids[key]}>{label}</i>{/each}
</span>

<style>
  .guide-lights {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    color: var(--set-dim);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  i {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-style: normal;
  }

  i::before {
    content: "";
    width: var(--space-2);
    height: var(--space-2);
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius-full);
    box-sizing: border-box;
  }

  .guide-on {
    color: var(--foreground);
  }

  .guide-on::before {
    border-color: var(--success);
    background: var(--success);
  }
</style>
