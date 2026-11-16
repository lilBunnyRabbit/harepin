<script lang="ts">
  import type { Place } from "../../career/place";
  import Icon from "./Icon.svelte";

  interface Props {
    place: Place;
  }

  let { place }: Props = $props();
</script>

<span class="ui-place" data-here={place.here || undefined}>
  {#if place.here}
    <span class="ui-place-dot"></span>Here
  {:else}
    <Icon name="icon-globe" />{place.name}
  {/if}
</span>

<style>
  .ui-place {
    --icon-size: var(--text-md);
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    height: var(--space-6);
    padding: 0 var(--space-3);
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-full);
    background: var(--background-darkest);
    color: var(--foreground);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  [data-here] {
    border-style: solid;
    background: var(--background-lighter);
  }

  .ui-place-dot {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: 50%;
    background: var(--success);
  }
</style>
