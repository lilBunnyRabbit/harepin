<script lang="ts">
  import { tier_look } from "../../career/badge";
  import type { TierBadge } from "../../net/net";
  import "../../career/badge.css";

  interface Props {
    tier: TierBadge;
    decorative?: boolean;
  }

  let { tier, decorative = false }: Props = $props();

  const look = $derived(tier_look(tier));
</script>

<span
  class="career-badge"
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
