<script lang="ts">
  import { free_enter } from "../menu/enter-key";
  import { pause_press } from "./pause-keys";
  import PauseSheet from "./PauseSheet.svelte";
  import type { PauseAct, PauseView } from "./pause-view.svelte";

  interface Props {
    view: PauseView;
  }

  let { view }: Props = $props();

  let dialog: HTMLDialogElement;

  const STEP: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

  $effect(() => {
    if (view.shown && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>(".ui-primary")?.focus({ focusVisible: false });
    } else if (!view.shown && dialog.open) dialog.close();
  });

  // The dialog closes before the act: a later close hands focus back to whatever had it, over the settings or chat input the act focused.
  function choose(pick: PauseAct) {
    dialog.close();
    view.act(pick);
  }

  function key(event: KeyboardEvent) {
    const press = pause_press(view.keys, event);
    if (press) return "act" in press ? choose(press.act) : view.flip(press.aid);
    if (free_enter(event)) {
      event.preventDefault();
      event.stopPropagation();
      return view.close();
    }
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const step = STEP[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const items = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled)")].filter((item) => item.checkVisibility());
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + step + items.length) % items.length]?.focus({ focusVisible: true });
  }
</script>

<dialog bind:this={dialog} class="pause" aria-label="Paused" onclose={() => view.close()} onkeydown={key}>
  {#if view.card && view.aids}
    <PauseSheet card={view.card} aids={view.aids} solo={view.solo} caps={view.keys.caps} onact={choose} onflip={(aid) => view.flip(aid)} onresume={() => view.close()} />
  {/if}
</dialog>

<style>
  .pause {
    box-sizing: border-box;
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--foreground);
    font-family: var(--font-sans);
    user-select: none;
  }

  :global(body:has(.pause[open]) > :not(#app, .pause-host)) {
    visibility: hidden;
  }

  .pause::backdrop {
    background: none;
  }
</style>
