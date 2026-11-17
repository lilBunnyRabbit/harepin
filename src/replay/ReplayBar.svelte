<script lang="ts">
  import { format } from "../hud/hud";
  import { typing } from "../hud/input";
  import Button from "../menu/ui/Button.svelte";
  import IconButton from "../menu/ui/IconButton.svelte";
  import Slider from "../menu/ui/Slider.svelte";
  import { Save, type ReplayView } from "./replay-view.svelte";

  interface Props {
    view: ReplayView;
  }

  let { view }: Props = $props();

  const SCRUB_STEP_MS = 100;
  const SAVE_LABEL: Record<Save, string> = { [Save.NONE]: "", [Save.READY]: "Save", [Save.SAVING]: "Saving", [Save.SAVED]: "Saved", [Save.FAILED]: "Not saved" };

  function key(event: KeyboardEvent) {
    if (!view.shown || event.code !== "Space" || event.repeat || typing(event.target)) return;
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
    {#if view.save !== Save.NONE}
      <Button size="sm" variant="quiet" icon={view.save === Save.SAVED ? "icon-check" : undefined} aria-label="Save replay" disabled={view.save === Save.SAVING || view.save === Save.SAVED} onclick={() => view.acts.save()}>{SAVE_LABEL[view.save]}</Button>
    {/if}
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

  :global(body:has(.replay-bar) #hud-menu-btn) {
    display: none;
  }

  .replay-scrub {
    flex: 1;
    min-width: 0;
  }

  /* The touch pedals and stick fly the free camera from the bottom corners. */
  @media (pointer: coarse) {
    .replay-bar {
      top: var(--inset-top);
      bottom: auto;
    }
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
