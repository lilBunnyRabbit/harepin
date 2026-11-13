<script lang="ts">
  import { axis_value, fit_zone, INNER_MAX, OUTER_MIN } from "../../hud/pad-curve";
  import { pad_settings, type SettingKey } from "../prefs";
  import type { MenuState } from "../ui/menu-state.svelte";
  import Progress from "../ui/Progress.svelte";
  import LinkRow from "./rows/LinkRow.svelte";
  import SliderRow from "./rows/SliderRow.svelte";
  import SettingRow from "./SettingRow.svelte";

  interface Props {
    live: MenuState;
  }

  let { live }: Props = $props();

  type Axis = "steer" | "throttle" | "brake";
  type Zone = `pad_${Axis}_${"inner" | "outer"}` & SettingKey;

  const CURVE_STEPS = 48;
  const ZONES: [Axis, [string, string], [string, string]][] = [
    [
      "steer",
      ["Steering inside deadzone", "Stick travel from centre that steers nothing. Raise it if the car pulls with the stick let go."],
      ["Steering outside deadzone", "Stick travel that already gives full lock. Lower reaches full lock before the stick hits its edge."],
    ],
    ["throttle", ["Throttle inside deadzone", "Right trigger travel that gives no gas."], ["Throttle outside deadzone", "Right trigger travel that already gives full gas."]],
    ["brake", ["Brake inside deadzone", "Left trigger travel that gives no brake."], ["Brake outside deadzone", "Left trigger travel that already gives full brake."]],
  ];

  let open = $state(false);
  let preview: HTMLElement | undefined = $state();
  let reading = $state({ pad: false, tilt: 0, steer: 0, throttle: 0, brake: 0 });

  const response = $derived(pad_settings(live.prefs));
  const curve = $derived(
    Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
      const x = i / CURVE_STEPS;
      return `${(x * 100).toFixed(1)},${(100 - axis_value(x, response.steer) * 100).toFixed(1)}`;
    }).join(" "),
  );

  function fit(axis: Axis, inner: number, outer: number, keep: "inner" | "outer") {
    const [fi, fo] = fit_zone(inner, outer, keep);
    live.set(`pad_${axis}_inner` as Zone, fi);
    live.set(`pad_${axis}_outer` as Zone, fo);
  }

  const zone = (axis: Axis, end: "inner" | "outer") => live.prefs[`pad_${axis}_${end}` as Zone];

  // The live dot only runs while the preview is on screen; each menu refresh restarts it once it shows again.
  let running = false;
  $effect(() => {
    live.live(() => open);
    if (running || !preview?.checkVisibility()) return;
    running = true;
    const draw = () => {
      if (!preview?.isConnected || !preview.checkVisibility()) {
        running = false;
        return;
      }
      const pad = navigator.getGamepads().find((p) => p?.connected) ?? null;
      const raw = pad?.axes[0] ?? 0;
      const next = {
        pad: pad !== null,
        tilt: Math.abs(raw),
        steer: Math.abs(axis_value(raw, response.steer)),
        throttle: axis_value(pad?.buttons[7]?.value ?? 0, response.throttle),
        brake: axis_value(pad?.buttons[6]?.value ?? 0, response.brake),
      };
      if ((Object.keys(next) as (keyof typeof next)[]).some((key) => next[key] !== reading[key])) reading = next;
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  });
</script>

<LinkRow
  label="Advanced controller"
  help="Gamepad deadzones and steering response. Keyboard and touch are not affected."
  value="Deadzones, linearity"
  open={() => (open = !open)}
  expanded={open}
/>
{#each ZONES as [axis, inner, outer], at (axis)}
  {#if open}
    <SliderRow label={inner[0]} help={inner[1]} value={zone(axis, "inner")} step={1} max={INNER_MAX} onchange={(value) => fit(axis, value, zone(axis, "outer"), "inner")} />
    <SliderRow label={outer[0]} help={outer[1]} value={zone(axis, "outer")} step={1} min={OUTER_MIN} onchange={(value) => fit(axis, zone(axis, "inner"), value, "outer")} />
    {#if at === 0}
      <SliderRow
        label="Steering linearity"
        help="0 is linear: the wheels follow the stick. Higher steers finer near centre and keeps full lock for the edge."
        value={live.prefs.pad_steer_linearity}
        unit=""
        onchange={(value) => live.set("pad_steer_linearity", value)}
      />
    {/if}
  {/if}
{/each}
{#if open}
  <SettingRow label="Response" help="The line is the steering curve, the dot is your stick now. The bars are what the triggers give." custom>
    <div class="set-pad" bind:this={preview}>
      <svg class="set-plot" viewBox="0 0 100 100" aria-hidden="true">
        <rect class="set-plot-frame" x="0" y="0" width="100" height="100" />
        <line class="set-plot-linear" x1="0" y1="100" x2="100" y2="0" />
        <polyline class="set-plot-line" points={curve} />
        {#if reading.pad}<circle class="set-plot-dot" r="4" cx={(reading.tilt * 100).toFixed(1)} cy={(100 - reading.steer * 100).toFixed(1)} />{/if}
      </svg>
      <div class="set-pad-side">
        <span class="set-meter"><small>Gas</small><Progress value={reading.throttle} max={1} label="Gas" /></span>
        <span class="set-meter"><small>Brake</small><Progress value={reading.brake} max={1} label="Brake" /></span>
        <small class="set-pad-note">{reading.pad ? `Steer ${Math.round(reading.steer * 100)}%` : "No controller"}</small>
      </div>
    </div>
  </SettingRow>
{/if}

<style>
  .set-pad {
    display: flex;
    align-items: stretch;
    gap: var(--space-5);
    width: 14rem;
  }

  .set-plot {
    flex: none;
    width: 6rem;
    height: 6rem;
    overflow: visible;
  }

  .set-plot-frame {
    fill: var(--set-well);
    stroke: var(--set-line);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .set-plot-linear {
    stroke: var(--line-strong);
    stroke-dasharray: 3 3;
    vector-effect: non-scaling-stroke;
  }

  .set-plot-line {
    fill: none;
    stroke: var(--primary);
    stroke-width: 2;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .set-plot-dot {
    fill: var(--foreground);
  }

  .set-pad-side {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
  }

  .set-meter {
    display: grid;
    gap: var(--space-1);
  }

  .set-meter small,
  .set-pad-note {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }
</style>
