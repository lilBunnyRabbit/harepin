<script lang="ts">
  import Kbd from "../ui/Kbd.svelte";
  import type { MenuState } from "../ui/menu-state.svelte";
  import SettingRow from "./SettingRow.svelte";
  import { KEYS, chips, list_help, shown } from "./sections";

  interface Props {
    live: MenuState;
  }

  let { live }: Props = $props();
</script>

{#snippet cell(text: string, kind: string)}
  <span class="set-keys-cell" data-kind={kind}>
    {#each chips(text) as part, at (at)}
      {#if part.chip}<Kbd keys={[part.text]} />{:else}<span class="set-keys-sep">{part.text.trim()}</span>{/if}
    {/each}
  </span>
{/snippet}

<div class="set-keys">
<div class="set-keys-head" aria-hidden="true">
  <span>Keyboard</span>
  <span data-kind="pad">Gamepad</span>
</div>
{#each KEYS as [what, keyboard, pad, touch] (what)}
  <SettingRow label={what} help={() => list_help(live.prefs.bindings)} line={touch ? `Touch: ${touch}` : undefined} stack>
    <span class="set-keys-row">
      {@render cell(shown(keyboard, live.prefs.bindings), "keys")}
      {@render cell(shown(pad, live.prefs.bindings), "pad")}
    </span>
  </SettingRow>
{/each}
</div>

<style>
  .set-keys {
    display: contents;
  }

  .set-keys-head,
  .set-keys-row {
    display: grid;
    grid-template-columns: 11rem 9rem;
    gap: var(--space-4);
  }

  .set-keys-head {
    justify-content: end;
    padding: 0 var(--space-4) var(--space-1);
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .set-keys-cell {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
  }

  .set-keys-sep {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .set-keys-row :global(.ui-key) {
    font-size: var(--text-sm);
  }

  @media (pointer: coarse) {
    :global(.settings:not([data-pad])) [data-kind="pad"] {
      display: none;
    }

    :global(.settings:not([data-pad])) .set-keys-head,
    :global(.settings:not([data-pad])) .set-keys-row {
      grid-template-columns: 11rem;
    }
  }

  @media (pointer: fine) {
    .set-keys :global(.ui-help) {
      display: none;
    }
  }

  @media (max-width: 600px) {
    .set-keys-head {
      display: none;
    }

    .set-keys-row {
      grid-template-columns: auto;
      justify-items: start;
    }
  }
</style>
