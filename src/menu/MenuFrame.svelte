<script lang="ts">
  import type { Snippet } from "svelte";
  import { STATIONS, type Menu } from "./page";
  import Chip from "./ui/Chip.svelte";
  import PageFrame from "./ui/PageFrame.svelte";
  import Stations from "./ui/Stations.svelte";
  import { menu_state } from "./ui/svelte-page.svelte";

  interface Props {
    menu: Menu;
    /** The page's own id in `page_list`: a station gets the station bar, and Back names where it leads from here. */
    id: string;
    eyebrow?: string;
    title?: string;
    /** Replaces the frame's own chips: season stars and the online count. */
    chips?: Snippet;
    /** False on a page that shows the season itself. */
    season?: boolean;
    links?: Snippet;
    note?: string;
    primary?: Snippet;
    veil?: number;
    floor?: boolean;
    /** Where Back leads when the page takes it itself (`MenuPage.back`), in place of the page above. */
    back_to?: string;
    children?: Snippet;
  }

  let { menu, id, eyebrow, title, chips, season = true, links, note, primary, veil, floor, back_to, children }: Props = $props();

  const live = $derived(menu_state(menu));
  const station = $derived(STATIONS.find((one) => one.id === id)?.id);
  const up = $derived(live.live(() => menu.up_of(id)));
  const stars = $derived(live.live(() => menu.host.runs.stars));
  const online = $derived(live.live(() => menu.host.online_count()));
</script>

{#snippet bar()}
  {#if station}<Stations items={STATIONS} value={station} label="Stations" onchange={(to) => menu.show(to)} />{/if}
{/snippet}

{#snippet frame_chips()}
  {#if season}<Chip title={`${stars} season stars`}><span class="menu-frame-star">★</span>{stars}</Chip>{/if}
  {#if online > 1}<Chip tone="live" title={`${online} players online`}>{online} online</Chip>{/if}
{/snippet}

<PageFrame {eyebrow} {title} stations={bar} chips={chips ?? frame_chips} back={{ to: back_to ?? up, go: () => menu.back() }} {links} {note} {primary} {veil} {floor}>
  {@render children?.()}
</PageFrame>

<style>
  .menu-frame-star {
    color: var(--warning);
  }
</style>
