<script lang="ts">
  import { season_days_left, season_number } from "../../runs/runs";
  import { RewardKind, SEASON_MAX, SEASON_STEP, SEASON_TRACK, next_step, reward_code, season_steps, title_text, type SeasonReward } from "../../runs/season";
  import Card from "../ui/Card.svelte";
  import Progress from "../ui/Progress.svelte";
  import { reward_text } from "./run-text";
  import "../events.css";

  interface Props {
    stars: number;
    season: string;
    today: string;
  }

  let { stars, season, today }: Props = $props();

  const steps = $derived(season_steps(stars));
  const next = $derived(next_step(stars));
  const days = $derived(season_days_left(today));
  const marks = SEASON_TRACK.map((_, i) => (i + 1) * SEASON_STEP);
  const name = $derived(`Season ${season_number(season)}`);
  const label = (reward: SeasonReward) => (reward.kind === RewardKind.TITLE ? (title_text(reward_code(reward, season)) ?? reward.label) : reward_text(reward));
</script>

<Card pad="sm" flat class="season-bar" label={name}>
  <div class="season-row">
    <div class="season-text">
      <span class="ev-eyebrow">{name} · {days} {days === 1 ? "day" : "days"} left</span>
      <b class="ev-h2"><span class="season-star">★</span> {stars} season stars</b>
    </div>
    <Progress value={Math.min(stars, SEASON_MAX)} max={SEASON_MAX} {marks} size="hero" label={`${name}: ${stars} season stars, ${steps} of ${SEASON_TRACK.length} rewards`} />
    <div class="season-text season-next">
      {#if next}
        <span class="ev-eyebrow">Next reward at {next.at} ★</span>
        <b class="ev-nowrap">{label(next.reward)}</b>
      {:else}
        <span class="ev-eyebrow">This season</span>
        <b class="ev-nowrap">Every reward won</b>
      {/if}
    </div>
  </div>
</Card>

<style>
  .season-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--pad);
    min-width: 0;
  }

  .season-text {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .season-next {
    text-align: right;
  }

  .season-star {
    color: var(--warning);
  }

  /* Portrait: the two texts share the top line and the bar runs under them. */
  @media (max-width: 700px) {
    .season-row {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--gap-md);
    }

    .season-row > :global(:nth-child(2)) {
      grid-row: 2;
      grid-column: 1 / -1;
    }
  }
</style>
