/** Modal dialogs seen opening, newest last; one closed or taken out of the page drops off on the next read. */
const seen: HTMLDialogElement[] = [];

// `beforetoggle` runs inside showModal, so the dialog counts from the same frame on; `toggle` would land a task later.
const on_toggle = (event: Event) => {
  const dialog = event.target;
  if (dialog instanceof HTMLDialogElement && (event as ToggleEvent).newState === "open" && !seen.includes(dialog)) seen.push(dialog);
};

export function watch_modals() {
  for (const dialog of document.querySelectorAll<HTMLDialogElement>("dialog:modal")) if (!seen.includes(dialog)) seen.push(dialog);
  document.addEventListener("beforetoggle", on_toggle, { capture: true });
}

export function unwatch_modals() {
  document.removeEventListener("beforetoggle", on_toggle, { capture: true });
  seen.length = 0;
}

/** The modal dialog on top. Read on every frame and input poll, so it answers from the dialogs seen opening, never a document query. */
export function top_modal(): HTMLDialogElement | null {
  for (let i = seen.length - 1; i >= 0; i--) {
    if (seen[i].matches(":modal")) return seen[i];
    seen.splice(i, 1);
  }
  return null;
}

/** A modal dialog (the update card) is up: menu moves walk its controls, not the page behind it. */
export const modal_open = () => top_modal() !== null;
