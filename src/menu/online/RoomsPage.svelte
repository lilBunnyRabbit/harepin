<script lang="ts">
  import type { Announce } from "../../net/directory";
  import { bare_enter, link_key } from "../drive-picks";
  import MenuFrame from "../MenuFrame.svelte";
  import Card from "../ui/Card.svelte";
  import Chip from "../ui/Chip.svelte";
  import KeyLink from "../ui/KeyLink.svelte";
  import PrimaryAction from "../ui/PrimaryAction.svelte";
  import ScrollArea from "../ui/ScrollArea.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import { join_game } from "./join";
  import RoomHead from "./RoomHead.svelte";
  import { NEW_ROOM_PAGE, ROOMS_PAGE, room_groups, totals, type RoomGroup } from "./rooms";
  import UnlockForm from "./UnlockForm.svelte";

  const EMPTY = {
    connecting: "Looking for rooms…",
    online: "No other rooms right now. New room opens one of your own.",
    offline: "No other rooms found. Invite links still work.",
  };

  let { menu, live, shown }: PageProps = $props();

  const host = $derived(menu.host);
  const players = $derived(live.live(() => host.players_online()));
  const groups = $derived(room_groups(players, host.version));
  const rooms = $derived(groups.filter((group) => !group.here));
  const online = $derived(totals(groups).players);
  const status = $derived(live.live(() => host.servers_status()));

  let picked = $state<string | null>(null);
  let asking = $state.raw<Announce | null>(null);

  const open = $derived(rooms.filter((group) => group.blocked === null));
  const pick = $derived(open.find((group) => group.key === picked) ?? open[0] ?? null);
  const note = $derived(asking ? "" : pick ? `Joining moves you to ${pick.map}${pick.racing ? ", where a race is running" : ""}.` : "");

  export function back(): boolean {
    if (!asking) return false;
    asking = null;
    return true;
  }

  $effect(() => {
    if (!shown) return;
    host.browse_servers(true);
    return () => host.browse_servers(false);
  });

  $effect(() => {
    if (!shown) asking = null;
  });

  function detail({ game, blocked }: RoomGroup): string {
    const ping = players.find((player) => player.game.key === game.key)?.ping ?? null;
    const parts = [`Host ${game.host}`];
    if (ping !== null) parts.push(`${ping} ms`);
    if (game.locked) parts.push("password");
    if (blocked) parts.push(blocked.toLowerCase());
    return parts.join(" · ");
  }

  function join(group: RoomGroup) {
    if (group.game.locked) asking = group.game;
    else join_game(menu, group.game, null);
  }

  function press(click: MouseEvent, group: RoomGroup) {
    picked = group.key;
    if (click.detail === 0) join(group);
  }

  function key(event: KeyboardEvent) {
    if (!shown || asking) return;
    if (bare_enter(event)) {
      event.preventDefault();
      if (pick) join(pick);
      else menu.show(NEW_ROOM_PAGE);
    } else if (link_key(event) === "n") menu.show(NEW_ROOM_PAGE);
  }
</script>

<svelte:window onkeydown={key} />

<MenuFrame {menu} id={ROOMS_PAGE} eyebrow="Online" title="Other rooms" veil={0.55} {note}>
  {#snippet chips()}
    {#if online > 1}<Chip tone="live">{online} online</Chip>{/if}
  {/snippet}
  <div class="rooms">
    <Card list class="rooms-card" label="Other rooms">
      {#if asking}
        {#key asking}<UnlockForm {menu} target={asking} oncancel={() => (asking = null)} />{/key}
      {:else if rooms.length}
        <ScrollArea class="rooms-rows">
          {#each rooms as group (group.key)}
            <button type="button" class="rooms-row" data-focused={group.key === pick?.key ? "" : undefined} disabled={group.blocked !== null} onfocus={() => (picked = group.key)} onclick={(click) => press(click, group)}>
              <RoomHead {group} detail={detail(group)} />
            </button>
          {/each}
        </ScrollArea>
      {:else}
        <p class="rooms-empty">{EMPTY[status]}</p>
      {/if}
    </Card>
  </div>
  {#snippet links()}
    {#if pick}<KeyLink keys={{ key: "N" }} onclick={() => menu.show(NEW_ROOM_PAGE)}>New room</KeyLink>{/if}
  {/snippet}
  {#snippet primary()}
    {#if pick && !asking}
      <PrimaryAction tone="online" onclick={() => join(pick)}>Join {pick.name}</PrimaryAction>
    {:else if !asking}
      <PrimaryAction tone="online" onclick={() => menu.show(NEW_ROOM_PAGE)}>New room</PrimaryAction>
    {/if}
  {/snippet}
</MenuFrame>

<style>
  .rooms {
    display: grid;
    grid-template-columns: minmax(0, 46rem);
    justify-content: center;
    align-content: start;
    height: 100%;
    min-height: 0;
  }

  .rooms > :global(.rooms-card) {
    max-height: 100%;
    overflow: hidden;
  }

  .rooms :global(.rooms-rows) {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
    min-height: 0;
  }

  /* :root lifts these over the old `.settings button` reset (0,1,1). */
  :root .rooms-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
    height: auto;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--foreground);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  :root .rooms-row:disabled {
    cursor: default;
  }

  :root .rooms-row:is([data-focused], :focus-visible) {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: calc(var(--mark-w) * -1);
  }

  .rooms-empty {
    margin: 0;
    padding: var(--gap-md);
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
    text-wrap: pretty;
  }

  @media (max-height: 500px) {
    .rooms {
      height: auto;
    }
  }
</style>
