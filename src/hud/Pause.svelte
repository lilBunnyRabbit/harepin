<script lang="ts">
  import PauseEvent from "./PauseEvent.svelte";
  import PauseRoam from "./PauseRoam.svelte";
  import type { PauseAct, PauseView } from "./pause-view.svelte";

  interface Props {
    view: PauseView;
  }

  let { view }: Props = $props();

  let dialog: HTMLDialogElement;

  const KEYS: Readonly<Record<string, PauseAct>> = { KeyR: "reset", KeyG: "garage", KeyM: "showroom", KeyO: "settings", KeyC: "camera", KeyT: "chat", KeyL: "leave" };
  const STEP: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

  $effect(() => {
    if (view.shown && !dialog.open) dialog.showModal();
    else if (!view.shown && dialog.open) dialog.close();
  });

  // The dialog closes before the act: a later close hands focus back to whatever had it, over the settings or chat input the act focused.
  function choose(pick: PauseAct) {
    dialog.close();
    view.act(pick);
  }

  function key(event: KeyboardEvent) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const pick = KEYS[event.code];
    if (pick) {
      event.preventDefault();
      return choose(pick);
    }
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
    {#if view.card.kind === "roam"}
      <PauseRoam card={view.card} aids={view.aids} solo={view.solo} onact={choose} onflip={(aid) => view.flip(aid)} onresume={() => view.close()} />
    {:else}
      <PauseEvent card={view.card} aids={view.aids} solo={view.solo} onact={choose} onflip={(aid) => view.flip(aid)} onresume={() => view.close()} />
    {/if}
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
    padding: var(--inset-top) var(--inset-right) var(--inset-bottom) var(--inset-left);
    border: 0;
    background: none;
    color: var(--foreground);
    font-family: var(--font-sans);
    font-size: var(--text-md);
    user-select: none;
  }

  :global(body:has(.pause[open]) > :not(#app, .pause-host)) {
    visibility: hidden;
  }

  .pause::backdrop {
    background: color-mix(in oklch, var(--background-darkest) 35%, transparent);
  }
</style>
