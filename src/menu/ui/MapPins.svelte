<script lang="ts">
  import type { MapPin } from "../maps";
  import { map_spot } from "../world-map.svelte";

  interface Props {
    /** The map's side in world metres; null while it draws, so no pin stands on the wrong spot. */
    size: number | null;
    pins: readonly MapPin[];
    picked: string | null;
    you?: { x: number; z: number } | null;
    onpick: (id: string) => void;
  }

  let { size, pins, picked, you = null, onpick }: Props = $props();

  const at = (x: number, z: number) => (size === null ? null : map_spot(size, x, z));
  const you_at = $derived(you && at(you.x, you.z));
</script>

{#if size !== null}
  <div class="ui-pins">
    {#if you_at}
      <span class="ui-pin-you" style:left={`${you_at[0] * 100}%`} style:top={`${you_at[1] * 100}%`} role="img" aria-label="You"></span>
    {/if}
    {#each pins as pin (pin.id)}
      {@const spot = at(pin.x, pin.z)}
      {#if spot}
        <button
          type="button"
          tabindex="-1"
          class="ui-pin"
          data-picked={pin.id === picked ? "" : undefined}
          style:left={`${spot[0] * 100}%`}
          style:top={`${spot[1] * 100}%`}
          aria-label={pin.label}
          title={pin.label}
          onclick={() => onpick(pin.id)}
        ></button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .ui-pins {
    --pin: var(--chip-h-in);
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  /* :root lifts these over the old `.settings button` reset (0,1,1). */
  :root .ui-pin,
  .ui-pin-you {
    position: absolute;
    width: var(--pin);
    height: var(--pin);
    min-height: 0;
    padding: 0;
    border: var(--mark-w) solid var(--background-darkest);
    translate: -50% -50%;
  }

  :root .ui-pin {
    border-radius: var(--radius-full);
    background: var(--accent);
    pointer-events: auto;
    cursor: pointer;
  }

  :root .ui-pin[data-picked] {
    z-index: 1;
    background: var(--cottontail);
  }

  .ui-pin-you {
    border-radius: var(--radius-xs);
    background: var(--info);
    rotate: 45deg;
    scale: 0.8;
  }
</style>
