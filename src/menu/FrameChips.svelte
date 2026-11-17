<script lang="ts">
  import { UpdateState } from "../version";
  import type { Menu } from "./page";
  import Chip from "./ui/Chip.svelte";
  import { menu_state } from "./ui/svelte-page.svelte";

  interface Props {
    menu: Menu;
    /** False on a page that shows the season itself, or has no use for it. */
    season?: boolean;
    /** False on What's new, whose own card offers the waiting update; a downloading one still shows. */
    offer?: boolean;
  }

  let { menu, season = true, offer = true }: Props = $props();

  const live = $derived(menu_state(menu));
  const stars = $derived(live.live(() => menu.host.runs.stars));
  const online = $derived(live.live(() => menu.host.online_count()));
  const update = $derived(live.live(() => menu.host.update_state()));
</script>

{#if update === UpdateState.READY}
  {#if offer}<Chip tone="live" title="A new version is ready: see what's new and update" onclick={() => menu.host.show_updates()}>Update ready</Chip>{/if}
{:else if update === UpdateState.COMING}
  <Chip title="A new version is downloading">Downloading update</Chip>
{/if}
{#if season}<Chip title={`${stars} season stars`}><span class="frame-star">★</span>{stars}</Chip>{/if}
{#if online > 1}<Chip tone="live" title={`${online} players online`}>{online} online</Chip>{/if}

<style>
  .frame-star {
    color: var(--warning);
  }
</style>
