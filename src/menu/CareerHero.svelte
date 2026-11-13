<script lang="ts">
  import { EVENTS, MAX_EVENT_STARS, TIERS, current_tier, suggested, tier_max, tier_of, tier_open, tier_stars, type CareerEvent, type Stars } from "../career/career";
  import { event_map } from "../career/career-store";
  import type { TierBadge as TierId } from "../net/net";
  import CarLimit from "./CarLimit.svelte";
  import { event_note } from "./career-text";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";
  import Icon from "./ui/Icon.svelte";
  import Link from "./ui/Link.svelte";
  import Progress from "./ui/Progress.svelte";
  import TierBadge from "./ui/TierBadge.svelte";
  import { preview } from "./widgets";

  interface Props {
    stars: Stars;
    onstart: (id: string) => void;
    onall: () => void;
  }

  let { stars, onstart, onall }: Props = $props();

  const PICKS = 3;

  // Only the last tier can be all 3-starred while open; then any open event short of 3 stars comes next.
  function up_next(stars: Stars): CareerEvent[] {
    const here = suggested(stars, PICKS);
    if (here.length) return here;
    return EVENTS.filter((event) => (stars[event.id] ?? 0) < MAX_EVENT_STARS && tier_open(stars, tier_of(event))).slice(0, PICKS);
  }

  const tier = $derived(current_tier(stars));
  const have = $derived(tier_stars(stars, tier));
  const max = $derived(tier_max(tier));
  const after = $derived(TIERS[TIERS.indexOf(tier) + 1]);
  const gate = $derived(after && !tier_open(stars, after) ? after : null);
  const picks = $derived(up_next(stars));
  const next = $derived(picks.at(0));

</script>

<Card>
  <div class="hero">
    <div class="head">
      <span class="shield"><TierBadge tier={(TIERS.indexOf(tier) + 1) as TierId} decorative /></span>
      <span class="tier">
        <span class="eyebrow">Career</span>
        <b>{tier.name}</b>
      </span>
      <span class="count"><b>{have}</b> / {max} ★</span>
    </div>

    <div class="track">
      <Progress value={have} {max} label={`${have} of ${max} stars in ${tier.name}`} marks={gate ? [gate.opens_at] : []} size="hero" />
      <div class="words">
        <span class="sum">{have} stars in {tier.name}</span>
        {#if gate}
          <span class="lock"><Icon name="icon-lock" />{gate.name} opens at {gate.opens_at} ★</span>
        {:else}
          <span class="lock">{have === max ? `Every ${tier.name} event at 3 ★` : "Last tier"}</span>
        {/if}
      </div>
    </div>

    {#if next}
      <div class="next">
        <img src={preview(event_map(next).kind)} alt="" decoding="async" />
        <span class="text">
          <span class="eyebrow">Next event · {next.id}</span>
          <span class="hero-event"><b>{next.name}</b><CarLimit event={next} /></span>
          <span class="note">{event_note(next)}</span>
        </span>
      </div>
      <Button variant="primary" size="lg" onclick={() => onstart(next.id)}>Continue career</Button>
      <div class="then">
        {#each picks.slice(1) as event (event.id)}
          <Button size="sm" class="pick" title={event_note(event)} onclick={() => onstart(event.id)}>{event.name}</Button>
        {/each}
        <Link chevron onclick={onall}>All events</Link>
      </div>
    {:else}
      <Button variant="primary" size="lg" onclick={onall}>All events</Button>
    {/if}
  </div>
</Card>

<style>
  .hero {
    display: grid;
    gap: var(--space-4);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .shield {
    display: flex;
    font-size: var(--text-3xl);
  }

  .tier {
    display: grid;
    gap: var(--space-0);
    margin-right: auto;
    min-width: 0;
  }

  .eyebrow {
    color: var(--set-dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .tier b {
    font-size: var(--text-3xl);
    line-height: 1.1;
  }

  .count {
    color: var(--set-dim);
    font-size: var(--text-xl);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .count b {
    color: var(--foreground);
    font-size: var(--text-2xl);
  }

  .track {
    display: grid;
    gap: var(--space-2);
  }

  .words {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .lock {
    --icon-size: var(--text-md);
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin-left: auto;
    font-weight: 600;
    white-space: nowrap;
  }

  .next {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4) var(--space-2) var(--space-2);
    border-radius: var(--radius-md);
    background: var(--set-well);
  }

  .next img {
    flex: none;
    display: block;
    width: 112px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: var(--radius-sm);
  }

  .text {
    display: grid;
    gap: var(--space-0);
    min-width: 0;
  }

  .hero-event {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
  }

  .hero-event b {
    font-size: var(--text-2xl);
    line-height: 1.2;
  }

  .note {
    overflow: hidden;
    color: var(--set-dim);
    font-size: var(--text-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .then {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .then > :global(.pick) {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .then > :global(:last-child) {
    flex: none;
    margin-left: auto;
  }

  @media (max-height: 500px) {
    .hero {
      gap: var(--space-3);
    }

    .shield {
      font-size: var(--text-2xl);
    }

    .tier b {
      font-size: var(--text-2xl);
    }

    .sum,
    .then > :global(.pick:nth-child(2)) {
      display: none;
    }

    .next img {
      width: 80px;
    }

    .hero-event b {
      font-size: var(--text-xl);
    }
  }
</style>
