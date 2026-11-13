<script lang="ts">
  import type { Snippet } from "svelte";
  import { CLASS_LABELS, type Rating } from "../../car/pi";

  interface SpecMeter {
    key: string;
    label: string;
    value: number;
    /** Bar height, 0-100. */
    bar: number;
  }

  interface Props {
    title: string;
    meta: string;
    rating: Rating;
    meters: readonly SpecMeter[];
    facts: Snippet;
    /** One small status beside the title; on a disabled card it is the reason and stays at full contrast. */
    tag?: Snippet;
    selected?: boolean;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
  }

  let { title, meta, rating, meters, facts, tag, selected = false, disabled = false, onclick }: Props = $props();
</script>

<button type="button" class="ui-spec-card" aria-pressed={selected} {disabled} {onclick}>
  <span class="ui-spec-body">
    <span class="ui-spec-class ui-spec-dim" data-class={rating.class}>
      <b>{CLASS_LABELS[rating.class]}</b>
      <small>{rating.pi}</small>
    </span>
    <span class="ui-spec-text">
      <span class="ui-spec-title-row">
        <span class="ui-spec-title ui-spec-dim">{title}</span>
        {#if tag}<span class="ui-spec-tag">{@render tag()}</span>{/if}
      </span>
      <span class="ui-spec-meta ui-spec-dim">{meta}</span>
      <span class="ui-spec-facts ui-spec-dim">{@render facts()}</span>
    </span>
    <span class="ui-spec-meters ui-spec-dim">
      {#each meters as meter (meter.key)}
        <span class="ui-spec-meter" role="meter" aria-label={meter.label} aria-valuenow={meter.value} aria-valuemin={0} aria-valuemax={100}>
          <span class="ui-spec-track"><span class="ui-spec-fill" style:height={`${meter.bar}%`}></span></span>
          <b>{meter.value}</b>
          <small>{meter.label}</small>
        </span>
      {/each}
    </span>
  </span>
</button>

<style>
  .ui-spec-card {
    --spec-class-w: calc(2 * var(--control-h-sm));
    --spec-meter-w: calc(2 * var(--control-h-sm));
    --spec-meter-h: var(--control-h-lg);
    container-type: inline-size;
    display: block;
    width: 100%;
    height: auto;
    padding: var(--space-3) var(--space-4) var(--space-3) var(--space-3);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-md);
    background: var(--set-raised);
    color: var(--foreground);
    font-weight: 400;
    text-align: left;
    white-space: normal;
  }

  .ui-spec-body {
    display: grid;
    grid-template: "class text meters" auto / auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }

  .ui-spec-card:hover:not(:disabled) {
    border-color: var(--line-strong);
    background: var(--set-raised);
  }

  .ui-spec-card[aria-pressed="true"] {
    border-color: var(--primary);
  }

  .ui-spec-card:focus-visible {
    outline: 2px solid var(--primary);
    /* Inset: a scrolling list (the car pick) clips anything drawn outside the card. */
    outline-offset: -1px;
  }

  .ui-spec-card:disabled {
    cursor: default;
  }

  .ui-spec-card:disabled .ui-spec-dim {
    opacity: 0.45;
  }

  .ui-spec-class {
    display: grid;
    grid-area: class;
    place-content: center;
    justify-items: center;
    align-self: stretch;
    width: var(--spec-class-w);
    border: 1.5px solid var(--dim);
    border-radius: var(--radius-sm);
    background: var(--set-well);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .ui-spec-class[data-class="x"],
  [aria-pressed="true"] .ui-spec-class {
    border-color: var(--primary);
  }

  .ui-spec-class b {
    font-size: var(--text-3xl);
    line-height: 1;
  }

  .ui-spec-class small {
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .ui-spec-text {
    display: grid;
    grid-area: text;
    gap: var(--space-0);
    min-width: 0;
  }

  .ui-spec-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .ui-spec-title {
    overflow: hidden;
    font-size: var(--text-xl);
    font-weight: 700;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ui-spec-tag {
    display: flex;
    flex: none;
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .ui-spec-meta {
    overflow: hidden;
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ui-spec-facts {
    display: flex;
    margin-top: var(--space-1);
    min-width: 0;
  }

  .ui-spec-meters {
    display: grid;
    grid-area: meters;
    grid-template-columns: repeat(3, var(--spec-meter-w));
    gap: var(--space-2);
  }

  .ui-spec-meter {
    display: grid;
    justify-items: center;
    gap: var(--space-0);
    min-width: 0;
  }

  .ui-spec-track {
    position: relative;
    width: var(--space-3);
    height: var(--spec-meter-h);
    margin-bottom: var(--space-1);
    border-radius: var(--radius-full);
    background: var(--set-well);
  }

  .ui-spec-fill {
    position: absolute;
    inset: auto 0 0;
    border-radius: inherit;
    background: var(--primary);
  }

  .ui-spec-meter b {
    font-family: var(--font-mono);
    font-size: var(--text-md);
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .ui-spec-meter small {
    overflow: hidden;
    max-width: 100%;
    color: var(--set-dim);
    font-size: var(--text-2xs);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @container (width < 360px) {
    .ui-spec-title-row {
      flex-wrap: wrap;
    }

    .ui-spec-body {
      grid-template:
        "class text" auto
        "meters meters" auto
        / auto minmax(0, 1fr);
    }

    .ui-spec-meters {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      padding-top: var(--space-2);
      border-top: 1px solid var(--set-line);
    }
  }

  @media (max-height: 500px) {
    .ui-spec-card {
      --spec-class-w: var(--control-h-lg);
      --spec-meter-h: var(--control-h-sm);
      padding: var(--space-2) var(--space-3) var(--space-2) var(--space-2);
    }

    .ui-spec-body {
      gap: var(--space-2) var(--space-3);
    }

    .ui-spec-class b {
      font-size: var(--text-2xl);
    }

    .ui-spec-meta {
      display: none;
    }
  }
</style>
