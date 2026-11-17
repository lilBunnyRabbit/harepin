<script lang="ts">
  import { untrack } from "svelte";
  import { DEFAULT_PARTS, STATS, build_spec, stats, type Build, type Stats } from "../car/build";
  import { STAT_NAMES, bar_of, signed, stat_rating, trend } from "./garage-meters";
  import { ease } from "./showroom/car-stage";
  import Progress from "./ui/Progress.svelte";

  interface Props {
    current: Build;
    shown: Build;
  }

  let { current, shown }: Props = $props();

  const COUNT_MS = 450;
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

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

<div class="garage-meters">
  {#each meters as meter (meter.key)}
    <span class="garage-label">{STAT_NAMES[meter.key]}</span>
    <div class="garage-meter">
      <Progress value={meter.fitted_bar * 100} ghost={meter.tried_bar * 100} max={100} marks={[meter.stock * 100]} label={STAT_NAMES[meter.key]} />
    </div>
    <span class="garage-value">{counted[meter.key] ?? meter.fitted}</span>
    <span class="garage-change" data-trend={meter.change.trend}>{meter.change.text}</span>
  {/each}
</div>

<style>
  /* The change column keeps its width, so a tried part never moves the bars. */
  .garage-meters {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 3ch 5ch;
    align-items: center;
    gap: var(--gap-sm) var(--gap-md);
    font-size: var(--type-small);
  }

  .garage-label {
    font-weight: 700;
  }

  .garage-value,
  .garage-change {
    font-family: var(--font-mono);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .garage-change {
    color: var(--dim);
    text-align: left;
    white-space: nowrap;
  }

  .garage-change[data-trend="up"] {
    color: var(--success);
  }

  .garage-change[data-trend="down"] {
    color: var(--error);
  }
</style>
