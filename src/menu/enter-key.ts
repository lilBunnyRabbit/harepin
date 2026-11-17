/** What `takes_enter` reads off an element: a DOM `Element` in the browser, a plain stand-in in a test. */
export interface EnterTarget {
  closest(selectors: string): EnterTarget | null;
  getAttribute(name: string): string | null;
}

/** Controls whose browser default acts on Enter: a button or link clicks, a field submits, a row with role=button accepts. */
const CONTROLS = "button, a, input, select, textarea, [role=button]";
/** A link-style nav button (KeyLink, BackPill) is about leaving: it leaves Enter to the page's primary. */
export const NAV_ATTR = "data-nav";
const ROOT_ATTR = "data-enter-own";

/** The focus takes Enter itself: the page's main Enter action stays out of its way. */
export function takes_enter(target: EnterTarget | null): boolean {
  const control = target?.closest(CONTROLS) ?? null;
  return control !== null && control.getAttribute(NAV_ATTR) === null;
}

/** Enter on nothing that takes it: no repeat, no modifier. A modal's own handler reads this; a page under modals reads `bare_enter`. */
export const free_enter = (event: KeyboardEvent) =>
  event.key === "Enter" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !takes_enter(event.target instanceof Element ? event.target : null);

function mark(target: EventTarget | null) {
  const own = target instanceof Element && takes_enter(target) && target.closest(".ui-primary") === null;
  document.documentElement.toggleAttribute(ROOT_ATTR, own);
}

const on_in = (event: FocusEvent) => mark(event.target);
const on_out = (event: FocusEvent) => mark(event.relatedTarget);

/** Marks the root while focus sits on a control that takes Enter itself, so the primary's Enter cap fades (key-cap.css). */
export function watch_enter_focus() {
  document.addEventListener("focusin", on_in);
  document.addEventListener("focusout", on_out);
}

export function unwatch_enter_focus() {
  document.removeEventListener("focusin", on_in);
  document.removeEventListener("focusout", on_out);
  document.documentElement.removeAttribute(ROOT_ATTR);
}
