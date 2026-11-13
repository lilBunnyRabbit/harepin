<script lang="ts">
  import Button from "../ui/Button.svelte";
  import ScrollArea from "../ui/ScrollArea.svelte";
  import GuideCar from "./GuideCar.svelte";
  import GuideControls from "./GuideControls.svelte";
  import GuideDrive from "./GuideDrive.svelte";
  import GuideHelp from "./GuideHelp.svelte";
  import GuideLook from "./GuideLook.svelte";
  import GuideTour from "./GuideTour.svelte";
  import GuideYou from "./GuideYou.svelte";
  import { GUIDE_STEPS, type GuideState } from "./guide.svelte";

  interface Props {
    guide: GuideState;
  }

  let { guide }: Props = $props();

  const STEPS = { you: GuideYou, look: GuideLook, controls: GuideControls, help: GuideHelp, car: GuideCar, tour: GuideTour, drive: GuideDrive };
  const Step = $derived(STEPS[guide.id]);
  const last = $derived(guide.step === GUIDE_STEPS.length - 1);

  function next() {
    if (last) guide.host.drive(guide.world);
    else guide.go(guide.step + 1);
  }
</script>

{#if guide.open}
  <section class="guide-panel" data-step={guide.id} aria-label="First-run guide">
    <ScrollArea class="guide-scroll">
      {#key guide.id}<Step {guide} />{/key}
    </ScrollArea>
    <footer class="guide-foot">
      {#if guide.step > 0}<Button icon="icon-back" onclick={() => guide.go(guide.step - 1)}>Back</Button>{/if}
      <small class="guide-small">{last ? "Run this guide again from Settings." : guide.step > 0 ? `Step ${guide.step + 1} of ${GUIDE_STEPS.length}` : ""}</small>
      <Button variant="primary" size="lg" onclick={next}>{last ? "Drive" : guide.step === 0 ? "Start" : "Next"}</Button>
    </footer>
  </section>
{/if}

<style>
  .guide-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    height: 100%;
    min-height: 0;
    padding: var(--space-8) var(--space-8) var(--space-6);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .guide-panel > :global(.guide-scroll) {
    flex: 1;
    margin: calc(-1 * var(--space-1));
    padding: var(--space-1);
  }

  .guide-foot {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding-top: var(--space-5);
    border-top: 1px solid var(--set-line);
  }

  .guide-small {
    flex: 1;
    min-width: 0;
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    text-wrap: pretty;
  }

  @media (max-width: 600px) {
    .guide-panel {
      padding: var(--space-5) var(--space-4) var(--space-4);
    }
  }

  @media (max-height: 500px) {
    .guide-panel {
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5) var(--space-3);
    }

    .guide-foot {
      padding-top: var(--space-3);
    }
  }

  :global {
    .settings:not([data-view="guide"]) :is(.guide-rail, .guide-host, .guide-skip),
    .settings[data-view="guide"] .settings-panel :is(.menu-tabs, .settings-head, .settings-body, .menu-room, .menu-close) {
      display: none;
    }

    .settings[data-view="guide"] {
      background: none;
    }

    .settings[data-view="guide"]::before {
      content: "";
      position: absolute;
      inset: 0;
      background: color-mix(in oklch, var(--background-darkest) 72%, transparent);
      backdrop-filter: blur(8px);
    }

    :root[data-scheme="light"] .settings[data-view="guide"]::before {
      background: color-mix(in oklch, var(--background-lighter) 78%, transparent);
    }

    /* The rail and panel sit centred below the top bar when they fit. The spacer rows give way first, the top one down
       to the usual gap, so a short window keeps the block at the top and the panel shrinks into its own scroll. */
    .settings[data-view="guide"] .settings-panel {
      inset: var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left);
      width: auto;
      max-width: 1280px;
      margin: 0 auto;
      border: 0;
      background: none;
      box-shadow: none;
      overflow: visible;
      grid-template:
        "top" auto
        "." minmax(var(--space-5), 1fr)
        "tabs" auto
        "." var(--space-5)
        "body" minmax(0, 640px)
        "." minmax(0, 1fr)
        / minmax(0, 1fr);
      gap: 0;
    }

    .settings[data-view="guide"] .settings-panel .menu-top {
      display: flex;
    }

    .guide-rail {
      grid-area: tabs;
      justify-self: start;
      max-width: 100%;
      min-width: 0;
    }

    .guide-host {
      grid-area: body;
      min-height: 0;
    }

    .guide-skip {
      display: flex;
    }

    @media (max-height: 500px) {
      .settings[data-view="guide"] .settings-panel {
        grid-template: "tabs top" auto "body body" minmax(0, 1fr) / minmax(0, 1fr) auto;
        gap: var(--space-3);
      }

      .settings[data-view="guide"] .settings-panel :is(.menu-brand, .menu-name) {
        display: none;
      }
    }
  }
</style>
