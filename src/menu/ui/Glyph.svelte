<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { GlyphKeys } from "./types";
  import "./key-cap.css";

  let { key, pad, touch }: GlyphKeys = $props();
</script>

<span class="ui-glyph">
  {#if key}<kbd class="ui-glyph-cap" data-glyph="key">{key}</kbd>{/if}
  {#if pad}<span class="ui-glyph-cap" data-glyph="pad" data-shape={pad.length === 1 ? "round" : "bumper"}>{pad}</span>{/if}
  {#if touch}<span class="ui-glyph-cap" data-glyph="touch" data-shape="round"><Icon name={touch} /></span>{/if}
</span>
