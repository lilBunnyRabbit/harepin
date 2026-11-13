<script lang="ts">
  import { tier_look } from "../../career/badge";
  import type { TierBadge } from "../../net/net";
  import "../../career/badge.css";

  interface Props {
    tier: TierBadge;
    decorative?: boolean;
    dim?: boolean;
  }

  let { tier, decorative = false, dim = false }: Props = $props();

  const look = $derived(tier_look(tier));
</script>

<span
  class="career-badge"
  class:ui-dim={dim}
  style:--metal={look.metal}
  style:--metal-ink={look.ink}
  style:--weave={look.weave}
  data-weave={look.weave ? "" : undefined}
  role={decorative ? undefined : "img"}
  aria-label={decorative ? undefined : look.text}
  aria-hidden={decorative || undefined}
  title={decorative ? undefined : look.text}
>
  <b>{look.letter}</b>
</span>

<style>
  .ui-dim {
    filter: grayscale(1);
    opacity: 0.45;
  }
</style>
