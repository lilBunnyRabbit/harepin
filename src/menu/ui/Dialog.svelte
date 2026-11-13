<script lang="ts">
  import type { Snippet } from "svelte";
  import ScrollArea from "./ScrollArea.svelte";

  interface Props {
    open: boolean;
    title: string;
    subtitle?: string;
    onclose?: () => void;
    actions?: Snippet;
    children: Snippet;
  }

  let { open = $bindable(), title, subtitle, onclose, actions, children }: Props = $props();

  const uid = $props.id();
  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function closed() {
    open = false;
    onclose?.();
  }
</script>

<dialog bind:this={dialog} class="ui-dialog" aria-labelledby={`${uid}-title`} onclose={closed}>
  <header class="ui-head">
    <h2 class="ui-title" id={`${uid}-title`}>{title}</h2>
    {#if subtitle}<p class="ui-subtitle">{subtitle}</p>{/if}
  </header>
  <ScrollArea class="ui-dialog-body">{@render children()}</ScrollArea>
  {#if actions}<footer class="ui-actions">{@render actions()}</footer>{/if}
</dialog>

<style>
  .ui-dialog {
    flex-direction: column;
    gap: var(--space-5);
    width: min(560px, calc(100vw - 2 * var(--inset)));
    max-width: none;
    max-height: calc(100dvh - 2 * var(--inset));
    padding: var(--space-6);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--panel);
    color: var(--foreground);
    box-shadow: var(--panel-shadow);
    font-size: var(--text-md);
    overflow: hidden;
  }

  .ui-dialog[open] {
    display: flex;
  }

  .ui-dialog::backdrop {
    background: color-mix(in oklch, var(--background-darkest) 55%, transparent);
  }

  .ui-head {
    display: grid;
    gap: var(--space-1);
  }

  .ui-title {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: 700;
    line-height: 1.2;
  }

  .ui-subtitle {
    margin: 0;
    color: var(--dim);
    font-size: var(--text-sm);
  }

  .ui-head + :global(.ui-dialog-body) {
    flex: 1;
  }

  .ui-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  @media (max-height: 500px) {
    .ui-dialog {
      gap: var(--space-4);
      padding: var(--space-4);
    }
  }
</style>
