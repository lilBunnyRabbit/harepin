<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import { ADJUST_EVENT } from "../dom";
  import Row from "../ui/Row.svelte";
  import { use_nav, type Help } from "./nav.svelte";

  interface Props {
    label: string;
    help: string | (() => string);
    line?: string;
    detail?: Snippet;
    visual?: Snippet;
    adjust?: (by: number) => void;
    accept?: () => void;
    custom?: boolean;
    hidden?: boolean;
    stack?: boolean;
    only?: "touch" | "desk";
    expanded?: boolean;
    waiting?: boolean;
    onleave?: () => void;
    children?: Snippet;
  }

  let { label, help, line, detail, visual, adjust, accept, custom = false, hidden = false, stack = false, only, expanded, waiting = false, onleave, children }: Props = $props();

  const nav = use_nav();
  const row_help: Help = {
    get title() {
      return label;
    },
    text: () => (typeof help === "string" ? help : help()),
    get visual() {
      return visual;
    },
  };

  const control = (target: EventTarget | null) => target instanceof Element && target.closest("button, input, select, a, label, form") !== null;

  // The row holds focus, not its controls (they take tabindex -1), so the pad and arrow keys move row by row and left / right change the value.
  const frame: Attachment<HTMLElement> = (node) => {
    nav.register(node, row_help);
    if (!adjust) return;
    const on = (event: Event) => adjust((event as CustomEvent<number>).detail);
    node.addEventListener(ADJUST_EVENT, on);
    return () => node.removeEventListener(ADJUST_EVENT, on);
  };

  function click(event: MouseEvent) {
    if (!accept || control(event.target)) return;
    accept();
  }

  function key(event: KeyboardEvent) {
    if (!accept || (event.key !== "Enter" && event.key !== " ")) return;
    if (event.target !== event.currentTarget && control(event.target)) return;
    event.preventDefault();
    accept();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex: the row is the focus stop the pad and arrow keys walk, its controls are click targets only -->
<div
  class="set-row"
  class:set-custom={custom}
  class:set-accept={accept !== undefined}
  data-set-row
  data-only={only}
  data-adjust={adjust ? "" : undefined}
  data-waiting={waiting || undefined}
  role={accept && !adjust ? "button" : undefined}
  aria-expanded={expanded}
  tabindex={custom ? undefined : 0}
  {hidden}
  onclick={click}
  onkeydown={key}
  onfocusin={() => nav.focus(row_help)}
  onfocusout={onleave}
  {@attach frame}
>
  <Row {label} help={line} {detail} {stack} control={children} />
</div>

<style>
  .set-row {
    border-radius: var(--radius-md);
    outline: none;
  }

  .set-row[hidden] {
    display: none;
  }

  .set-accept {
    cursor: pointer;
  }

  .set-row:hover {
    background: color-mix(in oklch, var(--set-raised) 40%, transparent);
  }

  .set-row:focus-visible,
  .set-custom:focus-within {
    background: var(--set-raised);
    box-shadow: inset 0 0 0 1px var(--line-strong);
  }

  .set-row[data-waiting] {
    box-shadow: inset 0 0 0 1px var(--primary);
  }

  @media (pointer: fine) {
    [data-only="touch"] {
      display: none;
    }
  }

  @media (pointer: coarse) {
    [data-only="desk"] {
      display: none;
    }
  }
</style>
