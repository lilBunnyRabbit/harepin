<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Glyph from "./Glyph.svelte";
  import type { GlyphKeys } from "./types";
  import "./key-cap.css";

  interface Props extends Omit<HTMLButtonAttributes, "children"> {
    keys?: GlyphKeys;
    /** Press length in ms that fires `onheld`; the fill grows over it and a shorter press does nothing. */
    hold?: number;
    onheld?: () => void;
    variant?: "fill" | "quiet";
    tone?: "primary" | "online";
    size?: "md" | "lg";
    children: Snippet;
  }

  let { keys, hold, onheld, variant = "fill", tone = "primary", size = "md", type = "button", class: extra, children, ...rest }: Props = $props();

  let holding = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function start() {
    if (hold === undefined || holding) return;
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
    if (hold === undefined || event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    start();
  }

  $effect(() => stop);
</script>

<button
  {type}
  class={["ui-key-btn", extra]}
  data-variant={variant}
  data-tone={tone}
  data-size={size}
  data-hold={hold === undefined ? undefined : ""}
  data-holding={holding ? "" : undefined}
  style:--hold-ms={hold === undefined ? undefined : `${hold}ms`}
  onpointerdown={down}
  onlostpointercapture={stop}
  onkeydown={key_down}
  onkeyup={stop}
  onblur={stop}
  {...rest}
>
  {#if keys}<Glyph {...keys} />{/if}
  <span>{@render children()}</span>
</button>
