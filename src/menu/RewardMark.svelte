<script lang="ts">
  import { paint_finish } from "../car/paint";
  import { TIERS } from "../career/career";
  import type { RewardView } from "../career/career-model";
  import { metal_ink } from "../career/marker-view";
  import type { TierBadge as TierId } from "../net/net";
  import { rgba, tier_metals } from "../theme/palette";
  import DecalTile from "./DecalTile.svelte";
  import Icon from "./ui/Icon.svelte";
  import TierBadge from "./ui/TierBadge.svelte";
  import "./decal-tile.css";

  interface Props {
    reward: RewardView;
    index: number;
  }

  let { reward, index }: Props = $props();

  const lab = $derived(tier_metals[index]);
  const weave = $derived(paint_finish(TIERS[index].rewards.paint)?.weave ?? null);
</script>

<span class="rw-mark" class:rw-got={reward.got}>
  {#if reward.kind === "paint"}
    <i class="garage-swatch" data-metal={weave ? undefined : true} data-carbon={weave ? true : undefined} style:--swatch={rgba(lab)} style:--swatch-base={weave ? rgba(weave.base) : undefined}></i>
  {:else if reward.kind === "decal" && reward.decal}
    <span class="rw-decal" style:--decal-paint={rgba(lab)} style:--decal-ink={rgba(metal_ink(lab))} style:--decal-mark={rgba(metal_ink(lab))} style:--decal-glass="var(--background-darkest)"><DecalTile decal={reward.decal} number={7} /></span>
  {:else if reward.kind === "car"}
    <span class="rw-car"><Icon name="icon-car" /></span>
  {:else}
    <span class="rw-badge"><TierBadge tier={(index + 1) as TierId} decorative /></span>
  {/if}
  {#if !reward.got}<span class="rw-lock"><Icon name="icon-lock" /></span>{/if}
</span>

<style>
  .rw-mark {
    --mark: 2.75rem;
    position: relative;
    display: inline-grid;
    place-items: center;
    flex: none;
    width: var(--mark);
    height: var(--mark);
    border-radius: var(--radius-md);
    background: var(--set-well);
  }

  .rw-mark:not(.rw-got) > :not(.rw-lock) {
    opacity: 0.4;
  }

  .rw-decal :global(.garage-decal) {
    width: calc(var(--mark) * 0.82);
  }

  .rw-badge {
    display: flex;
    font-size: calc(var(--mark) * 0.5);
  }

  .rw-car {
    --icon-size: calc(var(--mark) * 0.6);
    display: flex;
  }

  .rw-lock {
    --icon-size: var(--text-xs);
    position: absolute;
    right: calc(-1 * var(--space-1));
    bottom: calc(-1 * var(--space-1));
    display: grid;
    place-items: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: var(--radius-full);
    background: var(--set-raised);
    color: var(--set-dim);
  }
</style>
