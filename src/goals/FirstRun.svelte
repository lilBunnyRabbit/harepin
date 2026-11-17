<script lang="ts">
  import { key_label, pad_text } from "../hud/bindings";
  import { distance_text } from "../menu/maps";
  import Icon from "../menu/ui/Icon.svelte";
  import { FIRST_STEPS } from "./first-run";
  import type { FirstRunView } from "./first-run-view.svelte";
  import { GOALS, GoalId } from "./goals";

  interface Props {
    view: FirstRunView;
  }

  let { view }: Props = $props();

  const AFTER = GOALS[GOALS.findIndex((goal) => goal.id === GoalId.FLAG) + 1];

  const paint = $derived.by(() => {
    if (view.step > 1) return "";
    const bindings = view.host.bindings();
    const key = (action: "throttle" | "steer_left" | "steer_right") => key_label(bindings[action].keys[0] ?? "");
    if (view.step === 0) return `Hold ${view.input === "touch" ? "gas" : view.input === "pad" ? pad_text(bindings, "throttle") || "RT" : key("throttle")}`;
    if (view.input === "touch") return view.host.touch_steer() === "drag" ? "Drag to steer" : "Steer";
    return view.input === "pad" ? "Steer L stick" : `Steer ${key("steer_left")} ${key("steer_right")}`;
  });
  const flag = $derived(view.host.flag);
</script>

{#if view.shown}
  {#if paint}<div class="first-paint" aria-hidden="true">{paint}</div>{/if}
  <section class="first-steps" aria-label="First run">
    <ol>
      {#each FIRST_STEPS as label, i (label)}
        <li aria-current={i === view.step ? "step" : undefined} data-done={i < view.step ? "" : undefined}>
          <i>{#if i < view.step}<Icon name="icon-check" />{:else}{i + 1}{/if}</i>{label}
        </li>
      {/each}
    </ol>
    <button type="button" class="first-more" onclick={() => view.host.open_steps()}>First steps<Icon name="icon-back" flip /></button>
  </section>
  {#if flag.distance !== null}
    <section class="first-ticket" aria-label="First steps">
      <span class="first-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" style:rotate={`${flag.turn}deg`}><path d="M6 15l6-6 6 6" /></svg>
      </span>
      <div class="first-text">
        <span class="first-eyebrow">First steps · {view.done + 1} of {view.total}</span>
        <b class="first-title">Reach the first flag</b>
        <span class="first-next">{distance_text(flag.distance)} ahead · Next: {AFTER.title}</span>
      </div>
    </section>
  {/if}
{/if}

<style>
  /* One ticket points at the flag, never two. With the flag on another map this one is away, and Next up offers the travel. */
  :global(body:has(.first-ticket) .next-up-dock) {
    display: none;
  }

  .first-paint {
    position: fixed;
    top: 53%;
    left: 50%;
    transform: translateX(-50%) perspective(420px) rotateX(58deg);
    color: var(--foreground);
    font-size: var(--display-4);
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0.04em;
    opacity: 0.9;
    text-transform: uppercase;
    white-space: nowrap;
    pointer-events: none;
  }

  .first-steps,
  .first-ticket {
    position: fixed;
    display: flex;
    align-items: center;
    border: 1px solid var(--line-strong);
    border-radius: var(--card-radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--foreground);
    font-size: var(--type-body);
    line-height: 1.2;
  }

  .first-steps {
    top: var(--inset-top);
    left: 50%;
    translate: -50% 0;
    gap: var(--pad);
    min-height: var(--top-h);
    padding: var(--gap-sm) var(--pad);
  }

  ol {
    display: flex;
    align-items: center;
    gap: var(--pad);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: var(--gap-sm);
    color: var(--dim);
    font-weight: 700;
    white-space: nowrap;
  }

  li i {
    --icon-size: 1em;
    display: grid;
    place-items: center;
    width: 1.7em;
    height: 1.7em;
    border-radius: var(--radius-full);
    background: var(--fill);
    font-family: var(--font-mono);
    font-size: 0.85em;
    font-style: normal;
    font-weight: 700;
    line-height: 1;
  }

  li[aria-current],
  li[data-done] {
    color: var(--foreground);
  }

  li[aria-current] i {
    background: var(--primary);
    color: var(--on-primary);
  }

  li[data-done] i {
    color: var(--primary);
  }

  .first-more {
    --icon-size: 1em;
    display: inline-flex;
    align-items: center;
    gap: var(--gap-xs);
    height: auto;
    padding: 0 0 0 var(--gap-md);
    border: 0;
    border-left: 1px solid var(--line-strong);
    border-radius: 0;
    background: none;
    color: var(--dim);
    font: inherit;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
  }

  .first-more:hover {
    background: none;
    color: var(--cottontail);
  }

  .first-ticket {
    top: var(--inset-top);
    left: var(--inset-left);
    gap: var(--gap-md);
    padding: var(--gap-md) var(--pad) var(--gap-md) var(--gap-md);
  }

  .first-mark {
    --icon-size: 1.3em;
    display: grid;
    flex: none;
    place-items: center;
    width: var(--top-h);
    height: var(--top-h);
    border-radius: var(--radius-full);
    background: var(--primary);
    color: var(--on-primary);
  }

  .first-mark svg {
    width: 1.5em;
    height: 1.5em;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .first-text {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .first-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .first-title {
    font-size: var(--type-h3);
    font-weight: 800;
    white-space: nowrap;
  }

  .first-next {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
    white-space: nowrap;
  }

  @media (max-height: 500px) {
    .first-paint {
      top: 50%;
      transform: translateX(-50%) perspective(260px) rotateX(58deg);
    }

    .first-ticket {
      top: auto;
      bottom: var(--inset-bottom);
      left: 50%;
      translate: -50% 0;
    }

    .first-more {
      display: none;
    }
  }
</style>
