<script lang="ts">
  import type { Place } from "../../career/place";
  import Icon from "./Icon.svelte";

  interface Props {
    place: Place;
    /** A quieter note after the place: "340 m ahead", "another map". */
    tail?: string;
  }

  let { place, tail }: Props = $props();
</script>

<span class="ui-place-line" data-here={place.here || undefined}>
  <Icon name={place.here ? "icon-flag" : "icon-globe"} />
  <b>{place.here ? "Here" : place.name}</b>
  {#if tail}<span class="ui-place-tail">{tail}</span>{/if}
</span>

<style>
  .ui-place-line {
    --icon-size: 1.15em;
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    min-width: 0;
    color: var(--foreground);
    font-size: var(--type-small);
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
  }

  .ui-place-line > :global(svg) {
    color: var(--dim);
  }

  b {
    font-weight: 700;
  }

  [data-here] > :global(svg),
  [data-here] > b {
    color: var(--primary);
  }

  .ui-place-tail {
    overflow: hidden;
    color: var(--dim);
    text-overflow: ellipsis;
  }
</style>
