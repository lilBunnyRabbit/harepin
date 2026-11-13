<script lang="ts">
  import type { CareerEvent } from "../career/career";
  import type { Goal } from "../career/career-model";
  import type { TierBadge as TierId } from "../net/net";
  import RewardMark from "./RewardMark.svelte";
  import Button from "./ui/Button.svelte";
  import Progress from "./ui/Progress.svelte";
  import TierBadge from "./ui/TierBadge.svelte";

  interface Props {
    goals: Goal[];
    onstart: (event: CareerEvent) => void;
  }

  let { goals, onstart }: Props = $props();
</script>

<ul class="gl-list">
  {#each goals as goal, i (goal.key)}
    <li class="gl-goal">
      <div class="gl-top">
        {#if goal.reward}
          <RewardMark reward={goal.reward} index={goal.view.index} />
        {:else if goal.kind === "gate"}
          <span class="gl-gate"><TierBadge tier={(goal.view.index + 2) as TierId} decorative dim /></span>
        {:else}
          <span class="gl-gate gl-chase" aria-hidden="true">★</span>
        {/if}
        <span class="gl-text"><b>{goal.title}</b><small>{goal.detail}</small></span>
      </div>
      {#if goal.kind !== "badge"}<Progress value={goal.have} max={goal.of} label={goal.detail} />{/if}
      {#if goal.event}
        {@const event = goal.event}
        <Button size="sm" variant={i === 0 ? "primary" : undefined} onclick={() => onstart(event)}>Play {event.name}</Button>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .gl-list {
    display: grid;
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .gl-goal {
    display: grid;
    grid-template-rows: auto auto 1fr;
    align-content: start;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .gl-goal :global(.ui-button) {
    align-self: end;
    justify-self: start;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gl-top {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .gl-text {
    display: grid;
    gap: var(--space-0);
    min-width: 0;
  }

  .gl-text b {
    font-size: var(--text-lg);
    line-height: 1.2;
  }

  .gl-text small {
    color: var(--set-dim);
    font-size: var(--text-md);
  }

  .gl-gate {
    display: grid;
    place-items: center;
    flex: none;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: var(--radius-md);
    background: var(--set-well);
    font-size: var(--text-2xl);
  }

  .gl-chase {
    color: var(--accent);
  }

  @media (max-height: 500px) {
    .gl-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-3);
    }
  }

  @media (max-height: 500px), (max-width: 600px) {
    .gl-goal {
      grid-template-rows: auto 1fr;
      padding: var(--space-3);
    }

    .gl-goal :global(.ui-progress) {
      display: none;
    }

    .gl-top {
      gap: var(--space-3);
    }

    .gl-text small {
      font-size: var(--text-sm);
    }
  }
</style>
