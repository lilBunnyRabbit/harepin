<script lang="ts">
  import { untrack } from "svelte";
  import { DEFAULT_PARTS, STATS, build_spec, stats, type Build, type Stats } from "../car/build";
  import { CLASS_LABELS, rating } from "../car/pi";
  import { STAT_NAMES, bar_of, signed, stat_rating, trend } from "./garage-meters";
  import { ease } from "./garage-stage";
  import ClassBadge from "./ui/ClassBadge.svelte";
  import Progress from "./ui/Progress.svelte";
  import SectionHead from "./ui/SectionHead.svelte";

  interface Props {
    current: Build;
    shown: Build;
  }

  let { current, shown }: Props = $props();

  const COUNT_MS = 450;
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  const fitted_rating = $derived(rating(current));
  const tried_rating = $derived(rating(shown));
  const rating_change = $derived.by(() => {
    const fitted = fitted_rating;
    const tried = tried_rating;
    if (tried.pi !== fitted.pi)
      return { text: `→ ${tried.class === fitted.class ? "" : `${CLASS_LABELS[tried.class]} `}${tried.pi}`, trend: trend(tried.pi - fitted.pi) };
    const against = fitted.pi - rating({ ...shown, parts: DEFAULT_PARTS }).pi;
    return { text: against ? signed(against) : "", trend: trend(against) };
  });

  const meters = $derived.by(() => {
    const now = stats(build_spec(current));
    const next = stats(build_spec(shown));
    const stock = stats(build_spec({ ...shown, parts: DEFAULT_PARTS }));
    return STATS.map((key) => {
      const a = bar_of(key, now[key]);
      const b = bar_of(key, next[key]);
      const fitted = stat_rating(key, now[key]);
      const tried = stat_rating(key, next[key]);
      const against = fitted - stat_rating(key, stock[key]);
      const change = tried !== fitted ? { text: `→ ${tried}`, trend: trend(tried - fitted) } : { text: against ? signed(against) : "", trend: trend(against) };
      return { key, fitted, fitted_bar: a, tried_bar: b, stock: bar_of(key, stock[key]), change };
    });
  });

  let counted = $state<Partial<Record<keyof Stats, number>>>({});

  $effect(() => {
    const targets = meters.map(({ key, fitted }) => [key, fitted] as const);
    const from = untrack(() => ({ ...counted }));
    if (calm.matches || targets.every(([key, to]) => from[key] === undefined || from[key] === to)) {
      counted = Object.fromEntries(targets);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / COUNT_MS);
      counted = Object.fromEntries(targets.map(([key, to]) => [key, Math.round((from[key] ?? to) + (to - (from[key] ?? to)) * ease(u))]));
      if (u < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  });
</script>

<div class="garage-rating">
  <span class="garage-label">Class</span>
  <span class="garage-rating-slot">
    <span class="garage-change" data-trend={rating_change.trend}>{rating_change.text}</span>
    <ClassBadge rating={fitted_rating} size="lg" />
  </span>
</div>
<div class="garage-title"><SectionHead eyebrow="Against stock" /></div>
<div class="garage-meters">
  {#each meters as meter (meter.key)}
    <div class="garage-stat">
      <span class="garage-label">{STAT_NAMES[meter.key]}</span>
      <span class="garage-value">{counted[meter.key] ?? meter.fitted}</span>
      <span class="garage-change" data-trend={meter.change.trend}>{meter.change.text}</span>
      <div class="garage-meter">
        <Progress value={meter.fitted_bar * 100} ghost={meter.tried_bar * 100} max={100} marks={[meter.stock * 100]} label={STAT_NAMES[meter.key]} />
      </div>
    </div>
  {/each}
</div>

<style>
  .garage-rating {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  /* The delta hangs off the badge's left edge, so a tried part never slides the badge and an empty one leaves no gap. */
  .garage-rating-slot {
    position: relative;
    display: flex;
  }

  .garage-rating-slot .garage-change {
    position: absolute;
    inset-block: 0;
    right: calc(100% + var(--space-2));
    display: flex;
    align-items: center;
    white-space: nowrap;
  }

  .garage-meters {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 6ch;
    align-items: baseline;
    gap: var(--space-2) var(--space-3);
  }

  /* One wrapper per stat for the phone's four-column row; on wider screens the rows share one grid. */
  .garage-stat {
    display: contents;
  }

  .garage-label {
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .garage-value,
  .garage-change {
    font-family: var(--font-mono);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .garage-value {
    font-size: var(--text-xl);
  }

  .garage-change {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .garage-change[data-trend="up"] {
    color: var(--success);
  }

  .garage-change[data-trend="down"] {
    color: var(--error);
  }

  .garage-meter {
    grid-column: 1 / -1;
    margin-bottom: var(--space-1);
  }


  @media (orientation: landscape) and (max-height: 500px), (max-width: 700px) {
    .garage-title {
      display: none;
    }

    .garage-meters {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--space-3);
    }

    .garage-stat {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: baseline;
      column-gap: var(--space-1);
    }

    .garage-stat .garage-label {
      grid-column: 1 / -1;
      overflow: hidden;
      font-size: var(--text-xs);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .garage-value {
      font-size: var(--text-lg);
      text-align: left;
    }

    .garage-change {
      font-size: var(--text-xs);
      text-align: left;
    }

    .garage-meter {
      margin: var(--space-0) 0 0;
    }
  }
</style>
