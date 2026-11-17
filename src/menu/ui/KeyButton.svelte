<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { HOLD_EVENT } from "../dom";
  import Glyph from "./Glyph.svelte";
  import type { GlyphKeys } from "./types";
  import "./key-cap.css";

  interface Props extends Omit<HTMLButtonAttributes, "children" | "onpointerdown" | "onlostpointercapture" | "onkeydown" | "onkeyup" | "onblur"> {
    keys?: GlyphKeys;
    /** Press length in ms that fires `onheld`; the fill grows over it and a shorter press does nothing. */
    hold?: number;
    onheld?: () => void;
    variant?: "fill" | "quiet";
    tone?: "primary" | "online";
    children: Snippet;
  }

  let { keys, hold, onheld, variant = "fill", tone = "primary", type = "button", disabled, class: extra, children, ...rest }: Props = $props();

  let holding = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function start() {
    if (hold === undefined || holding || disabled) return;
    holding = true;
    timer = setTimeout(() => {
      holding = false;
      onheld?.();
    }, hold);
  }

  function stop() {
    clearTimeout(timer);
    holding = false;
  }

  function down(event: PointerEvent & { currentTarget: HTMLButtonElement }) {
    if (hold === undefined || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start();
  }

  function key_down(event: KeyboardEvent) {
    // Enter only: a hold button on the road keeps focus, and Space there is the handbrake.
    if (hold === undefined || event.repeat || event.key !== "Enter") return;
    event.preventDefault();
    start();
  }

  $effect(() => {
    if (disabled) stop();
  });

  const held: Attachment<HTMLButtonElement> = (node) => {
    const on = (event: Event) => ((event as CustomEvent<boolean>).detail ? start() : stop());
    node.addEventListener(HOLD_EVENT, on);
    return () => node.removeEventListener(HOLD_EVENT, on);
  };

  $effect(() => stop);
</script>

<button
  {@attach held}
  {...rest}
  {type}
  {disabled}
  class={["ui-key-btn", extra]}
  data-variant={variant}
  data-tone={tone}
  data-hold={hold === undefined ? undefined : ""}
  data-holding={holding ? "" : undefined}
  style:--hold-ms={hold === undefined ? undefined : `${hold}ms`}
  onpointerdown={down}
  onlostpointercapture={stop}
  onkeydown={key_down}
  onkeyup={stop}
  onblur={stop}
>
  {#if keys}<Glyph {...keys} />{/if}
  <span>{@render children()}</span>
</button>
