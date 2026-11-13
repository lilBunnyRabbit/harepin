<script lang="ts">
  import {
    BINDABLE,
    BIND_INFO,
    DEFAULT_BINDINGS,
    MENU_BUTTON,
    RESERVED_BUTTONS,
    RESERVED_KEYS,
    SHORTCUT_KEYS,
    key_label,
    pad_bindable,
    pad_label,
    pad_text,
    rebind_key,
    rebind_pad,
    type Bindable,
  } from "../../hud/bindings";
  import type { Caught } from "../../hud/input";
  import type { Menu } from "../page";
  import Kbd from "../ui/Kbd.svelte";
  import type { MenuState } from "../ui/menu-state.svelte";
  import SettingRow from "./SettingRow.svelte";

  interface Props {
    menu: Menu;
    live: MenuState;
  }

  let { menu, live }: Props = $props();

  let waiting = $state<Bindable | null>(null);
  let notes = $state<Partial<Record<Bindable, string>>>({});

  const cancels = (caught: Caught) => (caught.kind === "key" ? caught.code === "Escape" : caught.button === MENU_BUTTON);

  function refusal(action: Bindable, caught: Caught): string | null {
    if (caught.kind === "key") {
      if (SHORTCUT_KEYS.includes(caught.code)) return `${key_label(caught.code)} is kept for browser shortcuts`;
      return RESERVED_KEYS.includes(caught.code) ? `${key_label(caught.code)} stays with the menu` : null;
    }
    const fixed = BIND_INFO[action].fixed_pad;
    if (fixed) return `${fixed} drives this on the pad`;
    if (fixed !== undefined) return "Keyboard only";
    return RESERVED_BUTTONS.includes(caught.button) ? "LT and RT stay gas and brake" : null;
  }

  function note(action: Bindable, text: string | null) {
    const next = { ...notes };
    if (text === null) delete next[action];
    else next[action] = text;
    notes = next;
  }

  function stop() {
    menu.host.listen(null);
    waiting = null;
  }

  function caught(action: Bindable, got: Caught | null) {
    if (!got || cancels(got)) {
      waiting = null;
      return;
    }
    const refused = refusal(action, got);
    if (refused) {
      note(action, refused);
      menu.host.listen((next) => caught(action, next));
      return;
    }
    const { bindings: next, from, swapped } = got.kind === "key" ? rebind_key(live.prefs.bindings, action, got.code) : rebind_pad(live.prefs.bindings, action, got.button);
    note(action, null);
    if (from) {
      const name = got.kind === "key" ? key_label(got.code) : pad_label(got.button);
      const left_none = got.kind === "key" ? next[from].keys.length === 0 : next[from].pad === null;
      note(action, swapped ? `Swapped with ${BIND_INFO[from].label}` : `Taken from ${BIND_INFO[from].label}`);
      note(from, swapped ? `Swapped with ${BIND_INFO[action].label}` : `${name} moved to ${BIND_INFO[action].label}${left_none ? (got.kind === "key" ? " · no key" : " · no button") : ""}`);
    }
    waiting = null;
    live.set("bindings", next);
  }

  function start(action: Bindable) {
    note(action, null);
    waiting = action;
    menu.host.listen((got) => caught(action, got));
  }

  function reset() {
    if (waiting) stop();
    notes = {};
    live.set("bindings", DEFAULT_BINDINGS);
  }
</script>

{#each BINDABLE as action (action)}
  {@const now = waiting === action}
  {@const pad = pad_text(live.prefs.bindings, action)}
  {@const said = now ? [pad_bindable(action) ? "Press a key or button" : "Press a key", notes[action]].filter(Boolean).join(" · ") : (notes[action] ?? "")}
  <SettingRow
    label={BIND_INFO[action].label}
    help={pad_bindable(action)
      ? "Pick it, then press the new key or pad button. Esc or Start cancels. Taking one from another action leaves it the rest."
      : "Pick it, then press the new key. Esc cancels. Taking a key from another action leaves it the rest."}
    accept={() => (waiting === action ? stop() : start(action))}
    waiting={now}
    onleave={() => waiting === action && stop()}
  >
    <span class="set-bind">
      {#if said}<span class="set-bind-note" class:set-now={now}>{said}</span>{/if}
      {#if !now}
        <span class="set-bind-keys">
          {#if live.prefs.bindings[action].keys.length}<Kbd keys={live.prefs.bindings[action].keys.map(key_label)} />{/if}
          {#if pad}<span class="set-bind-pad"><Kbd keys={[pad]} /></span>{/if}
        </span>
      {/if}
    </span>
  </SettingRow>
{/each}
<SettingRow label="Reset to defaults" help="Every key and pad button back to how the game shipped." accept={reset}>
  <span class="set-bind-note">All keys and buttons</span>
</SettingRow>

<style>
  .set-bind {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .set-bind-note {
    min-width: 0;
    color: var(--set-dim);
    font-size: var(--text-md);
    text-align: right;
  }

  .set-now {
    color: var(--foreground);
  }

  .set-bind-keys {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-3);
  }

  .set-bind-keys :global(.ui-key) {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .set-bind-pad :global(.ui-key) {
    border-radius: var(--radius-full);
    background: none;
    font-family: var(--font-sans);
  }
</style>
