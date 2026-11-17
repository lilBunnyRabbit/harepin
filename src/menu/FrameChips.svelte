<script lang="ts">
  import type { Menu } from "./page";
  import Chip from "./ui/Chip.svelte";
  import { menu_state } from "./ui/svelte-page.svelte";

  interface Props {
    menu: Menu;
    /** False on a page that shows the season itself, or has no use for it. */
    season?: boolean;
  }

  let { menu, season = true }: Props = $props();

  const live = $derived(menu_state(menu));
  const stars = $derived(live.live(() => menu.host.runs.stars));
  const online = $derived(live.live(() => menu.host.online_count()));
</script>

{#if season}<Chip title={`${stars} season stars`}><span class="frame-star">★</span>{stars}</Chip>{/if}
{#if online > 1}<Chip tone="live" title={`${online} players online`}>{online} online</Chip>{/if}

<style>
  .frame-star {
    color: var(--warning);
  }
</style>
