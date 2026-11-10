import { BINDABLE, BIND_INFO, DEFAULT_BINDINGS, MENU_BUTTON, RESERVED_BUTTONS, RESERVED_KEYS, SHORTCUT_KEYS, key_label, pad_bindable, pad_label, pad_text, rebind_key, rebind_pad, type Bindable } from "../hud/bindings";
import type { Caught } from "../hud/input";
import type { SettingsMenu } from "./page";
import { el } from "./setting-rows";
import "./bindings.css";

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

function glyph(text: string): HTMLElement {
  return el("kbd", text.length === 1 ? "pad-glyph pad-face" : "pad-glyph", text);
}

export function binding_rows(m: SettingsMenu): HTMLElement[] {
  let waiting: Bindable | null = null;
  const notes = new Map<Bindable, string>();

  const finish = () => {
    waiting = null;
    m.refresh();
  };
  const stop = () => {
    m.host.listen(null);
    finish();
  };
  const caught = (action: Bindable, got: Caught | null) => {
    if (!got || cancels(got)) return finish();
    const refused = refusal(action, got);
    if (refused) {
      notes.set(action, refused);
      m.host.listen((next) => caught(action, next));
      return m.refresh();
    }
    const bindings = m.state().bindings;
    const { bindings: next, from, swapped } = got.kind === "key" ? rebind_key(bindings, action, got.code) : rebind_pad(bindings, action, got.button);
    notes.delete(action);
    if (from) {
      const name = got.kind === "key" ? key_label(got.code) : pad_label(got.button);
      const left_none = got.kind === "key" ? next[from].keys.length === 0 : next[from].pad === null;
      notes.set(action, swapped ? `Swapped with ${BIND_INFO[from].label}` : `Taken from ${BIND_INFO[from].label}`);
      notes.set(from, swapped ? `Swapped with ${BIND_INFO[action].label}` : `${name} moved to ${BIND_INFO[action].label}${left_none ? (got.kind === "key" ? " · no key" : " · no button") : ""}`);
    }
    waiting = null;
    m.set("bindings", next);
  };
  const start = (action: Bindable) => {
    notes.delete(action);
    waiting = action;
    m.host.listen((got) => caught(action, got));
    m.refresh();
  };

  const rows = BINDABLE.map((action) => {
    const { label } = BIND_INFO[action];
    const note = el("span", "bind-note");
    const keys = el("span", "bind-keys");
    const control = el("span", "row-bind");
    control.append(note, keys);
    const prompt = pad_bindable(action) ? "Press a key or button" : "Press a key";
    const help = pad_bindable(action) ? "Pick it, then press the new key or pad button. Esc or Start cancels. Taking one from another action leaves it the rest." : "Pick it, then press the new key. Esc cancels. Taking a key from another action leaves it the rest.";
    const row = m.rows.action(label, help, control, () =>
      waiting === action ? stop() : start(action),
    );
    row.addEventListener("focusout", () => waiting === action && stop());
    let shown = "";
    m.sync(() => {
      const binding = m.state().bindings[action];
      const pad = pad_text(m.state().bindings, action);
      const now = waiting === action;
      const text = now ? [prompt, notes.get(action)].filter(Boolean).join(" · ") : (notes.get(action) ?? "");
      const signature = [now, text, ...binding.keys, pad].join("|");
      if (signature === shown) return;
      shown = signature;
      row.toggleAttribute("data-waiting", now);
      note.textContent = text;
      keys.replaceChildren(...(now ? [] : [...binding.keys.map((code) => el("kbd", "bind-key", key_label(code))), ...(pad ? [glyph(pad)] : [])]));
    });
    return row;
  });

  const reset = m.rows.action("Reset to defaults", "Every key and pad button back to how the game shipped.", el("span", "row-info", "All keys and buttons"), () => {
    if (waiting) stop();
    notes.clear();
    m.set("bindings", DEFAULT_BINDINGS);
    m.refresh();
  });
  return [...rows, reset];
}
