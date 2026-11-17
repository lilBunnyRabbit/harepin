<script lang="ts">
  import type { Snippet } from "svelte";
  import { STATIONS, type Menu } from "./page";
  import PageFrame from "./ui/PageFrame.svelte";
  import Stations from "./ui/Stations.svelte";
  import { menu_state } from "./ui/svelte-page.svelte";

  interface Props {
    menu: Menu;
    /** The page's own id in `page_list`: a station gets the station bar, and Back names where it leads from here. */
    id: string;
    eyebrow?: string;
    title?: string;
    chips?: Snippet;
    links?: Snippet;
    note?: string;
    primary?: Snippet;
    veil?: number;
    floor?: boolean;
    children?: Snippet;
  }

  let { menu, id, eyebrow, title, chips, links, note, primary, veil, floor, children }: Props = $props();

  const live = $derived(menu_state(menu));
  const station = $derived(STATIONS.find((one) => one.id === id)?.id);
  const up = $derived(live.live(() => menu.up_of(id)));
</script>

{#snippet bar()}
  {#if station}<Stations items={STATIONS} value={station} label="Stations" onchange={(to) => menu.show(to)} />{/if}
{/snippet}

<PageFrame {eyebrow} {title} stations={bar} {chips} back={{ to: up, go: () => menu.back() }} {links} {note} {primary} {veil} {floor}>
  {@render children?.()}
</PageFrame>
