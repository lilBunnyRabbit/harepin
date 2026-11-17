<script lang="ts">
  import type { Snippet } from "svelte";
  import KeyButton from "./KeyButton.svelte";
  import type { GlyphKeys } from "./types";

  interface Props {
    keys?: GlyphKeys;
    disabled?: boolean;
    hold?: number;
    onheld?: () => void;
    tone?: "primary" | "online";
    onclick?: () => void;
    children: Snippet;
  }

  let { keys = { key: "Enter", pad: "A" }, disabled, hold, onheld, tone, onclick, children }: Props = $props();
</script>

<KeyButton class="ui-primary" {keys} {disabled} {hold} {onheld} {tone} {onclick}>{@render children()}</KeyButton>
