<script lang="ts">
  import { format } from "../hud/hud";
  import Button from "../menu/ui/Button.svelte";
  import IconButton from "../menu/ui/IconButton.svelte";
  import Slider from "../menu/ui/Slider.svelte";
  import type { ReplayView } from "./replay-view.svelte";

  interface Props {
    view: ReplayView;
  }

  let { view }: Props = $props();

  const SCRUB_STEP_MS = 100;

  function key(event: KeyboardEvent) {
    if (!view.shown || event.code !== "Space" || event.repeat) return;
    event.preventDefault();
    view.acts.toggle();
  }

  // A focused scrub would take the arrow keys that fly the free camera.
  function release(event: Event) {
    if (event.target instanceof HTMLInputElement) event.target.blur();
  }
</script>

<svelte:window onkeydown={key} />

{#if view.shown}
  <div class="replay-bar" role="group" aria-label="Replay" onpointerup={release}>
    <IconButton icon={view.paused ? "icon-play" : "icon-pause"} label={view.paused ? "Play" : "Pause"} title="Space" onclick={() => view.acts.toggle()} />
    <div class="replay-scrub">
      <Slider bind:value={view.ms} min={0} max={view.end_ms} step={SCRUB_STEP_MS} label="Replay time" {format} onchange={(ms) => view.acts.seek(ms)} />
    </div>
    <Button size="sm" variant="quiet" aria-label="Playback speed" onclick={() => view.acts.next_speed()}><span data-mono>{view.speed}×</span></Button>
    <Button size="sm" variant="quiet" icon="icon-camera" aria-label="Camera" onclick={() => view.acts.swap_camera()}>{view.free ? "Free" : "Chase"}</Button>
    <IconButton icon="icon-close" label="Close replay" title="Esc" onclick={() => view.acts.close()} />
  </div>
{/if}

<style>
  .replay-bar {
    position: fixed;
    z-index: 2;
    left: 50%;
    bottom: var(--inset-bottom);
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: min(44rem, 100% - var(--inset-left) - var(--inset-right));
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  /* The dash, the map and the run's clock read the held car, not the one on the tape. */
  :global(body:has(.replay-bar) .hud) {
    visibility: hidden;
  }

  .replay-scrub {
    flex: 1;
    min-width: 0;
  }

  @media (max-width: 600px) {
    .replay-bar {
      flex-wrap: wrap;
      justify-content: space-between;
    }

    .replay-scrub {
      order: -1;
      flex-basis: 100%;
    }
  }
</style>
