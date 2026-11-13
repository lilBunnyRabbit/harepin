<script lang="ts">
  import type { CareerEvent } from "../career/career";
  import { event_map } from "../career/career-store";
  import CarLimit from "./CarLimit.svelte";
  import RewardMark from "./RewardMark.svelte";
  import { MAX_EVENT_STARS } from "../career/career";
  import type { TierView } from "../career/career-model";
  import type { TierBadge as TierId } from "../net/net";
  import { rgba, tier_metals } from "../theme/palette";
  import { best_text, event_note } from "./career-text";
  import Button from "./ui/Button.svelte";
  import Icon from "./ui/Icon.svelte";
  import Progress from "./ui/Progress.svelte";
  import TierBadge from "./ui/TierBadge.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { preview } from "./widgets";

  interface Props {
    views: TierView[];
    menu: PageProps["menu"];
    live: PageProps["live"];
  }

  let { views, menu, live }: Props = $props();

  const career = $derived(menu.host.career);
  const start = (event: CareerEvent) => menu.host.start_event(event.id);
  const marks = (view: TierView) => [...new Set([view.tier.rewards.paint_at, ...(view.gate ? [view.gate.at] : [])])];
  // The line down to the next shield fills as this tier's stars near that tier's gate.
  const fill = (view: TierView) => (view.state === "passed" ? 1 : view.state === "locked" ? 0 : Math.min(1, view.have / (view.gate?.at ?? view.max)));
</script>

{#snippet event_card(event: CareerEvent, view: TierView)}
  {@const got = live.stars[event.id] ?? 0}
  {@const best = live.live(() => career.best(event))}
  <li class="sp-event" class:sp-final={event.final}>
    {#if event.final}<img class="sp-pic" src={preview(event_map(event).kind)} alt="" loading="lazy" decoding="async" />{/if}
    <div class="sp-text">
      {#if event.final}<span class="sp-eyebrow">{view.tier.name} final · wins the badge</span>{/if}
      <b>{event.name}</b>
      <span class="sp-note">{event_note(event)}</span>
    </div>
    <div class="sp-car"><CarLimit {event} /></div>
    <div class="sp-meta">
      <span class="sp-stars" aria-label={`${got} of ${MAX_EVENT_STARS} stars`}>{"★".repeat(got)}<i>{"★".repeat(MAX_EVENT_STARS - got)}</i></span>
      {#if best}<small>{best_text(event, best)}</small>{/if}
    </div>
    <Button size="sm" variant={event.final && !got && view.state !== "locked" ? "primary" : undefined} disabled={view.state === "locked"} aria-label={`Go: ${event.name}`} onclick={() => start(event)}>Go</Button>
  </li>
{/snippet}

<ol class="sp-spine">
  {#each views as view (view.tier.id)}
    <li class="sp-tier" data-state={view.state} style:--metal={rgba(tier_metals[view.index])} style:--fill={fill(view)}>
      <div class="sp-node"><TierBadge tier={(view.index + 1) as TierId} decorative dim={view.state === "locked"} /></div>
      <div class="sp-body">
        <div class="sp-head">
          <div class="sp-title">
            <h3>{view.tier.name}</h3>
            {#if view.state === "current"}<span class="sp-tag sp-here">You are here</span>{/if}
            {#if view.state === "passed" && view.won}<span class="sp-tag">Champion</span>{/if}
            {#if view.state === "locked"}<span class="sp-tag"><Icon name="icon-lock" /> Opens at {view.tier.opens_at} ★ in {views[view.index - 1].tier.name}</span>{/if}
          </div>
          <span class="sp-count"><b>{view.have}</b> / {view.max} ★</span>
        </div>
        <Progress value={view.have} max={view.max} marks={marks(view)} label={`${view.have} of ${view.max} stars in ${view.tier.name}`} />
        <ul class="sp-rewards">
          {#each view.rewards as reward (reward.kind)}
            <li class:sp-got={reward.got}>
              <RewardMark {reward} index={view.index} />
              <span><b>{reward.name}</b><small>{reward.got ? "Earned" : reward.how}</small></span>
            </li>
          {/each}
        </ul>

        {#if view.state === "current"}
          <ul class="sp-events">
            {#each view.tier.events as event (event.id)}{@render event_card(event, view)}{/each}
          </ul>
        {:else}
          <details class="sp-more">
            <summary>{view.tier.events.length} events{view.final ? ` · final: ${view.final.name}` : ""}</summary>
            <ul class="sp-events">
              {#each view.tier.events as event (event.id)}{@render event_card(event, view)}{/each}
            </ul>
          </details>
        {/if}
      </div>
    </li>
  {/each}
</ol>

<style>
  .sp-spine {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sp-tier {
    display: grid;
    grid-template-columns: 4rem 1fr;
    gap: var(--space-5);
  }

  .sp-node {
    position: relative;
    display: flex;
    justify-content: center;
    padding-top: var(--space-4);
    font-size: var(--text-3xl);
  }

  .sp-node::before,
  .sp-node::after {
    content: "";
    position: absolute;
    top: 4.5rem;
    bottom: var(--space-2);
    left: calc(50% - 2px);
    width: 4px;
    border-radius: var(--radius-full);
    background: var(--set-line);
  }

  .sp-node::after {
    background: var(--primary);
    transform: scaleY(var(--fill));
    transform-origin: top;
  }

  .sp-tier:last-child .sp-node::before,
  .sp-tier:last-child .sp-node::after {
    display: none;
  }

  .sp-body {
    display: grid;
    gap: var(--space-5);
    min-width: 0;
    margin-bottom: var(--space-6);
    padding: var(--space-5) var(--space-6);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  [data-state="current"] .sp-body {
    border-color: var(--metal);
  }

  .sp-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .sp-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .sp-title h3 {
    margin: 0;
    font-size: var(--text-2xl);
  }

  .sp-tag {
    --icon-size: var(--text-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-0) var(--space-2);
    border-radius: var(--radius-full);
    background: var(--set-well);
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .sp-tag.sp-here {
    background: var(--primary);
    color: var(--background-darkest);
  }

  .sp-count {
    color: var(--set-dim);
    font-size: var(--text-lg);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .sp-count b {
    color: var(--foreground);
    font-size: var(--text-xl);
  }

  .sp-rewards {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-8);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sp-rewards li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .sp-rewards li > span {
    display: grid;
  }

  .sp-rewards b {
    font-size: var(--text-md);
  }

  .sp-rewards small {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .sp-rewards li.sp-got small {
    color: var(--success);
  }

  [data-state="locked"] .sp-head,
  [data-state="locked"] .sp-rewards {
    opacity: 0.7;
  }

  .sp-events {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .sp-event {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--set-well);
  }

  .sp-event.sp-final {
    grid-column: 1 / -1;
    padding: var(--space-3) var(--space-5) var(--space-3) var(--space-3);
    border: 1px solid var(--metal);
    background: var(--set-raised);
  }

  .sp-pic {
    flex: none;
    width: 8rem;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: var(--radius-sm);
  }

  .sp-final b {
    font-size: var(--text-xl);
  }

  .sp-eyebrow {
    color: var(--set-dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .sp-text {
    display: grid;
    gap: var(--space-0);
    min-width: 0;
    margin-right: auto;
  }

  .sp-note {
    overflow: hidden;
    color: var(--set-dim);
    font-size: var(--text-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sp-meta {
    display: grid;
    justify-items: end;
    gap: var(--space-0);
    min-width: 4.5em;
    font-variant-numeric: tabular-nums;
  }

  .sp-meta small {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .sp-stars {
    color: var(--accent);
    letter-spacing: 0.15em;
  }

  .sp-stars i {
    color: var(--line-strong);
    font-style: normal;
  }

  .sp-more summary {
    width: fit-content;
    color: var(--set-dim);
    font-size: var(--text-md);
    font-weight: 600;
    cursor: pointer;
  }

  .sp-more[open] summary {
    margin-bottom: var(--space-3);
  }

  @media (max-height: 500px), (max-width: 600px) {
    .sp-tier {
      grid-template-columns: 2.5rem 1fr;
      gap: var(--space-3);
    }

    .sp-node {
      font-size: var(--text-2xl);
    }

    .sp-node::before,
    .sp-node::after {
      top: 3.5rem;
    }

    .sp-body {
      padding: var(--space-4);
    }

    .sp-pic {
      width: 5.5rem;
    }
  }
</style>
