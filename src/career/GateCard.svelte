<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { CARS } from "../car/cars";
  import CarStill from "../menu/CarStill.svelte";
  import { mode_name } from "../menu/career-text";
  import ClassBadge from "../menu/ui/ClassBadge.svelte";
  import IconButton from "../menu/ui/IconButton.svelte";
  import KeyButton from "../menu/ui/KeyButton.svelte";
  import { rgba } from "../theme/palette";
  import { MAX_EVENT_STARS, TIERS, tier_of } from "./career";
  import type { GateView } from "./gate-card.svelte";
  import { event_place, gate_row, marks_of } from "./gate";
  import { marker_tone } from "./marker-view";

  const HOLD_MS = 600;
  const KEYS = { key: "Enter", pad: "A", touch: "icon-play" };

  interface Props {
    view: GateView;
    onstart: () => void;
    onmore: () => void;
  }

  let { view, onstart, onmore }: Props = $props();

  const marker = $derived(view.marker);
  const event = $derived(marker?.event);
  const row = $derived(view.car && "row" in view.car ? gate_row(view.shelves, view.picked) : []);
  const chosen = $derived(row.find((c) => c.code === view.picked) ?? null);
  const lock = $derived.by(() => {
    if (!event || view.open) return "";
    const tier = tier_of(event);
    const before = TIERS[TIERS.indexOf(tier) - 1];
    return `Opens at ${tier.opens_at} ★ in ${before?.name ?? "the tier before"}`;
  });

  function note(c: (typeof row)[number]): string {
    if (c.blocked) return c.blocked;
    if (c.fitted) return "Driving now";
    return c.sub && c.sub !== CARS[c.build.car].name ? c.sub : "Fits";
  }

  // Keys reach the hold button with nothing else focused; the chat's Enter skips a focused button.
  const take_focus: Attachment<HTMLElement> = (node) => {
    if (!view.open || document.activeElement !== document.body || document.documentElement.dataset.input === "touch") return;
    node.querySelector<HTMLElement>(".ui-key-btn")?.focus({ preventScroll: true, focusVisible: false });
  };

  let card = $state<HTMLElement>();

  // A clicked button loses focus (main.ts), so the hold button takes it back for Enter.
  function pick(code: string) {
    view.picked = code;
    card?.querySelector<HTMLElement>(".ui-key-btn")?.focus({ preventScroll: true, focusVisible: false });
  }
</script>

{#if marker && event}
  {#key `${event.id}:${view.open}`}
    <section class="hud event-card" style:--tier={rgba(marker_tone(marker, view.open))} data-row={row.length ? "" : undefined} aria-label={event.name} bind:this={card} {@attach take_focus}>
      <header class="gate-what">
        <span class="gate-eyebrow">{event_place(event)} · {mode_name(event)}</span>
        <b class="gate-title">{event.name}</b>
        {#if lock}
          <span class="gate-lock">{lock}</span>
        {:else}
          <span class="gate-marks">
            {#each marks_of(event) as mark (mark.stars)}
              <span class="gate-mark" data-got={view.have >= mark.stars ? "" : undefined} aria-label={`${mark.stars} of ${MAX_EVENT_STARS} stars: ${mark.text}`}><i>{"★".repeat(mark.stars)}</i>{mark.text}</span>
            {/each}
          </span>
        {/if}
      </header>
      {#if row.length && view.open}
        <ul class="gate-cars" aria-label="Car">
          {#each row as c (c.code)}
            <li>
              <button type="button" class="gate-car" aria-pressed={c.code === view.picked} disabled={c.blocked !== null} data-fitted={c.fitted ? "" : undefined} onclick={() => pick(c.code)}>
                <CarStill car={c.build.car} />
                <ClassBadge rating={c.rating} />
                <span class="gate-car-name"><b>{c.title}</b></span>
                <span class="gate-car-note">{note(c)}</span>
              </button>
            </li>
          {/each}
        </ul>
        <div class="gate-foot">
          <KeyButton keys={KEYS} hold={HOLD_MS} onheld={onstart} disabled={!chosen}>Hold to start{chosen ? ` in ${chosen.title}` : ""}</KeyButton>
          <IconButton class="gate-more" icon="icon-car" label="All cars" title="All cars" onclick={onmore} />
        </div>
      {:else if view.open}
        <div class="gate-go">
          {#if view.car && "lent" in view.car}
            <span class="gate-carline">
              <CarStill car={view.car.lent} />
              <span><b>{CARS[view.car.lent].name}</b><small>lent for this event</small></span>
            </span>
          {/if}
          <KeyButton keys={KEYS} hold={HOLD_MS} onheld={onstart}>Hold to start</KeyButton>
        </div>
      {/if}
    </section>
  {/key}
{/if}
