<script lang="ts">
  import { season_days_left, season_number } from "../../runs/runs";
  import { RewardKind, SEASON_MAX, SEASON_STEP, SEASON_TRACK, next_step, reward_code, season_steps, title_text, type SeasonReward } from "../../runs/season";
  import Progress from "../ui/Progress.svelte";
  import { reward_text } from "./run-text";

  interface Props {
    stars: number;
    season: string;
    today: string;
    compact?: boolean;
  }

  let { stars, season, today, compact = false }: Props = $props();

  const steps = $derived(season_steps(stars));
  const next = $derived(next_step(stars));
  const days = $derived(season_days_left(today));
  const marks = SEASON_TRACK.map((_, i) => (i + 1) * SEASON_STEP);
  const name = $derived(`Season ${season_number(season)}`);
  const label = (reward: SeasonReward) => (reward.kind === RewardKind.TITLE ? (title_text(reward_code(reward, season)) ?? reward.label) : reward_text(reward));
  const next_text = $derived(next ? `Next: ${label(next.reward)} at ${next.at} ★` : "Every step reached this season");
</script>

<div class="season-bar" class:compact>
  <div class="line">
    <span class="name">{name}</span>
    <b>{stars} ★</b>
  </div>
  <Progress value={Math.min(stars, SEASON_MAX)} max={SEASON_MAX} {marks} label={`${name}: ${stars} season stars, ${steps} of ${SEASON_TRACK.length} steps`} />
  {#if compact}
    <p class="dim">{next_text}</p>
  {:else}
    <ol class="steps" aria-label="Season steps">
      {#each SEASON_TRACK as reward, i (i)}
        <li class="step" data-state={i < steps ? "got" : i === steps ? "next" : "ahead"}>
          <span class="at">{(i + 1) * SEASON_STEP} ★</span>
          <span class="reward">
            {#if reward.kind === RewardKind.TINT}<span class="swatch" style:--swatch={`var(--${reward.id})`}></span>{/if}
            {label(reward)}
          </span>
        </li>
      {/each}
    </ol>
    <p class="dim">{next_text}. Ends in {days} {days === 1 ? "day" : "days"}; tints stay yours, titles carry the season.</p>
  {/if}
</div>

<style>
  .season-bar {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }

  .line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .name {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .compact .name {
    font-size: var(--text-md);
  }

  .line b {
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  .steps {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
    margin: var(--space-2) 0 0;
    padding: 0;
    list-style: none;
  }

  .step {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-md);
    color: var(--set-dim);
  }

  .step[data-state="got"] {
    border-color: transparent;
    background: var(--set-soft);
    color: var(--foreground);
  }

  .step[data-state="next"] {
    border-color: var(--primary);
    color: var(--foreground);
  }

  .at {
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  .reward {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    font-weight: 600;
  }

  .swatch {
    flex: none;
    width: 0.9em;
    height: 0.9em;
    border-radius: var(--radius-full);
    background: var(--swatch);
  }

  .step[data-state="ahead"] .swatch {
    opacity: 0.5;
  }

  .dim {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }
</style>
