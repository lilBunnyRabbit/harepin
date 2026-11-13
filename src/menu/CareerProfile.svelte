<script lang="ts">
  import type { TierView } from "../career/career-model";
  import type { TierBadge as TierId } from "../net/net";
  import Progress from "./ui/Progress.svelte";
  import TierBadge from "./ui/TierBadge.svelte";

  interface Props {
    here: TierView;
    total: { have: number; max: number };
  }

  let { here, total }: Props = $props();
</script>

<div class="pf-card">
  <span class="pf-shield"><TierBadge tier={(here.index + 1) as TierId} decorative /></span>
  <span class="pf-eyebrow">Driver rank</span>
  <h2>{here.tier.name}</h2>
  <span class="pf-total"><b>{total.have}</b> of {total.max} career ★</span>
  <div class="pf-bar"><Progress value={total.have} max={total.max} label={`${total.have} of ${total.max} career stars`} /></div>
</div>

<style>
  .pf-card {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas: "shield eyebrow" "shield name" "shield total" "bar bar";
    align-content: start;
    gap: 0 var(--space-5);
    padding: var(--space-6);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .pf-shield {
    grid-area: shield;
    align-self: center;
    display: flex;
    font-size: 3.5rem;
  }

  .pf-eyebrow {
    grid-area: eyebrow;
    color: var(--set-dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    grid-area: name;
    margin: 0;
    font-size: var(--text-3xl);
    line-height: 1.15;
  }

  .pf-total {
    grid-area: total;
    color: var(--set-dim);
    font-size: var(--text-md);
  }

  .pf-total b {
    color: var(--foreground);
  }

  .pf-bar {
    grid-area: bar;
    margin-top: var(--space-4);
  }

  @media (max-height: 500px), (max-width: 600px) {
    .pf-card {
      grid-template-columns: auto auto 1fr;
      grid-template-areas: "shield eyebrow bar" "shield name bar" "shield total bar";
      gap: 0 var(--space-3);
      padding: var(--space-3) var(--space-4);
    }

    .pf-shield {
      font-size: 2.5rem;
    }

    h2 {
      font-size: var(--text-2xl);
    }

    .pf-bar {
      align-self: center;
      margin: 0 0 0 var(--space-5);
    }
  }
</style>
