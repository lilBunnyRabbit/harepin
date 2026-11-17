<script lang="ts">
  import { format } from "../hud/hud";
  import MenuFrame from "../menu/MenuFrame.svelte";
  import Button from "../menu/ui/Button.svelte";
  import IconButton from "../menu/ui/IconButton.svelte";
  import Row from "../menu/ui/Row.svelte";
  import RowList from "../menu/ui/RowList.svelte";
  import ScrollArea from "../menu/ui/ScrollArea.svelte";
  import type { PageProps } from "../menu/ui/svelte-page.svelte";
  import { map_code } from "../worldgen/kinds/map-code";
  import { delete_replay, load_replays } from "./replay-store";
  import { MAX_REPLAYS, REPLAYS_PAGE, watched, type SavedReplay } from "./saved";

  interface Props extends PageProps {
    /** Opens the replay over the road; a reason when it can't now. */
    watch: (replay: SavedReplay) => string;
  }

  let { menu, shown, watch }: Props = $props();

  const KEEPS = `Keeps your last ${MAX_REPLAYS}. Save one from the replay's bar after a run.`;

  let replays = $state.raw<SavedReplay[]>([]);
  let loaded = $state(false);
  let refused = $state("");

  const here = $derived(map_code({ kind: menu.host.kind, seed: menu.host.seed, levels: menu.host.levels }));
  const day = (at: number) => new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  $effect(() => {
    if (!shown) return;
    refused = "";
    void load_replays().then((list) => {
      replays = list;
      loaded = true;
    });
  });

  async function remove(replay: SavedReplay) {
    if (await delete_replay(replay.id)) replays = replays.filter((one) => one.id !== replay.id);
  }
</script>

<MenuFrame {menu} id={REPLAYS_PAGE} eyebrow="Events" title="Replays" season={false} note={refused || KEEPS}>
  <ScrollArea class="replays">
    {#if replays.length}
      <RowList label="Saved replays">
        {#each replays as replay (replay.id)}
          {#snippet control()}
            {#if replay.map === here}
              <Button size="sm" icon="icon-play" onclick={() => (refused = watch(replay))}>Watch</Button>
            {:else}
              <span class="replays-away">Drive there to watch</span>
            {/if}
            <IconButton icon="icon-close" label={`Delete ${replay.name}`} onclick={() => remove(replay)} />
          {/snippet}
          <Row label={replay.name} help={`${replay.mode} · ${format(watched(replay).end_ms)} · ${replay.place} · ${day(replay.at)}`} {control} fill stack />
        {/each}
      </RowList>
    {:else if loaded}
      <p class="replays-none">No replays saved yet.</p>
    {/if}
  </ScrollArea>
</MenuFrame>

<style>
  :global(.replays) {
    max-width: 44rem;
  }

  .replays-away,
  .replays-none {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 500;
  }

  .replays-none {
    margin: 0;
  }
</style>
