<script lang="ts">
  import { country_name, flag } from "../../net/country";
  import type { Announce } from "../../net/directory";
  import type { Player } from "../../net/players";
  import { bare_enter, link_key } from "../drive-picks";
  import MenuFrame from "../MenuFrame.svelte";
  import { MenuTab, invite_link } from "../page";
  import Card from "../ui/Card.svelte";
  import KeyLink from "../ui/KeyLink.svelte";
  import PrimaryAction from "../ui/PrimaryAction.svelte";
  import ScrollArea from "../ui/ScrollArea.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import TierBadge from "../ui/TierBadge.svelte";
  import { COPIED_MS } from "../widgets";
  import { join_game } from "./join";
  import OnlineRoom from "./OnlineRoom.svelte";
  import RoomHead from "./RoomHead.svelte";
  import { MEET_PAGE, NEW_ROOM_PAGE, ROOMS_PAGE, joinable, room_groups, totals, totals_text } from "./rooms";
  import UnlockForm from "./UnlockForm.svelte";

  const COPY = "Copy invite";
  const EMPTY = {
    connecting: "Looking for players…",
    online: "Nobody else is online right now. Copy invite brings a friend to your room.",
    offline: "No other rooms found. Invite links still work.",
  };

  let { menu, live, shown }: PageProps = $props();

  const host = $derived(menu.host);
  const groups = $derived(room_groups(live.live(() => host.players_online()), host.version, live.live(() => host.map_name())));
  const sums = $derived(totals(groups));
  const others = $derived(groups.filter((group) => !group.here).length);
  const status = $derived(live.live(() => host.servers_status()));
  const failed = $derived(live.live(() => host.password_failed()));
  const own = $derived(groups.find((group) => group.here)?.game ?? null);
  const open = $derived(joinable(groups));

  let picked = $state<string | null>(null);
  let asking = $state.raw<Announce | null>(null);
  let copy_label = $state(COPY);

  const pick = $derived(open.find((player) => player.key === picked) ?? open[0] ?? null);
  const pick_group = $derived(pick && groups.find((group) => group.game.key === pick.game.key));
  const races = $derived(host.race_routes.length > 0);
  const verb = $derived(pick ? `Join ${pick.name}` : races ? "Race meet" : COPY);
  const note = $derived(
    asking ? "" : pick_group ? `Joining moves you to ${pick_group.map}${pick_group.racing ? ", where a race is running" : ""}.${pick_group.game.locked ? " It asks for the password." : ""}` : races ? "Race the drivers in your room." : "",
  );

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

  function join(player: Player) {
    if (player.game.locked) asking = player.game;
    else join_game(menu, player.game, null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite_link(host.room, host.seed, host.kind, host.code));
      copy_label = "Copied";
    } catch (error) {
      console.warn("online: clipboard refused", error);
      copy_label = "Copy failed";
    }
    setTimeout(() => (copy_label = COPY), COPIED_MS);
  }

  function go() {
    if (pick) join(pick);
    else if (races) menu.show(MEET_PAGE);
    else void copy();
  }

  function key(event: KeyboardEvent) {
    if (!shown || asking) return;
    if (bare_enter(event)) {
      event.preventDefault();
      return go();
    }
    const link = link_key(event);
    if (link === "i") void copy();
    else if (link === "o") menu.show(ROOMS_PAGE);
    else if (link === "n") menu.show(NEW_ROOM_PAGE);
  }
</script>

<svelte:window onkeydown={key} />

<MenuFrame {menu} id={MenuTab.ONLINE} season={false} veil={0.55} {note}>
  <div class="online">
    <OnlineRoom {menu} {live} onretry={failed && own?.locked ? () => (asking = own) : undefined} />
    <Card pad="none" class="online-list" label="Players online">
      <header class="online-list-head">
        <h2>Players online</h2>
        <span class="online-list-sum">{totals_text(sums)}</span>
      </header>
      {#if asking}
        <div class="online-list-ask">{#key asking}<UnlockForm {menu} target={asking} oncancel={() => (asking = null)} />{/key}</div>
      {:else}
        <ScrollArea class="online-list-rows">
          {#each groups as group (group.key)}
            <div class="online-group">
              <RoomHead {group} />
              {#each group.players as player (player.key)}
                {@const can = !group.here && group.blocked === null}
                <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events: the Join button in the row is the control; a tap on the row only aims the primary at it -->
                <div class="online-player" data-focused={player.key === pick?.key ? "" : undefined} onclick={can ? () => (picked = player.key) : undefined}>
                  <span class="online-flag" title={player.country ? country_name(player.country) : undefined}>{player.country ? flag(player.country) : ""}</span>
                  <b class="online-name">{player.name}</b>
                  {#if player.tier}<TierBadge tier={player.tier} />{/if}
                  <span class="online-end">
                    {#if player.you}
                      <span class="online-tag">you</span>
                    {:else if group.here}
                      <span class="online-tag">with you</span>
                    {:else if group.blocked}
                      <span class="online-tag">{group.blocked}</span>
                    {:else}
                      <button type="button" class="online-join" aria-label={`Join ${player.name}`} onfocus={() => (picked = player.key)} onclick={() => join(player)}>Join</button>
                    {/if}
                  </span>
                </div>
              {/each}
              {#if group.more}<div class="online-player"><span class="online-flag"></span><span class="online-tag">and {group.more} more</span></div>{/if}
            </div>
          {/each}
          {#if !others}<p class="online-empty">{EMPTY[status]}</p>{/if}
        </ScrollArea>
      {/if}
    </Card>
  </div>
  {#snippet links()}
    <KeyLink keys={{ key: "I" }} onclick={copy}>{copy_label}</KeyLink>
    <KeyLink keys={{ key: "O" }} onclick={() => menu.show(ROOMS_PAGE)}>Other rooms{others ? ` · ${others}` : ""}</KeyLink>
    <KeyLink keys={{ key: "N" }} onclick={() => menu.show(NEW_ROOM_PAGE)}>New room</KeyLink>
  {/snippet}
  {#snippet primary()}
    {#if !asking}<PrimaryAction tone="online" onclick={go}>{verb}</PrimaryAction>{/if}
  {/snippet}
</MenuFrame>

<style>
  .online {
    display: grid;
    grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .online > :global(.online-list) {
    gap: 0;
    overflow: hidden;
  }

  .online-list-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--gap);
    padding: var(--pad) var(--pad) var(--gap-md);
  }

  h2 {
    margin: 0;
    font-size: var(--type-h3);
    font-weight: 700;
    line-height: 1.2;
  }

  .online-list-sum,
  .online-tag,
  .online-empty {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .online-list-sum {
    white-space: nowrap;
  }

  .online-list-ask {
    padding: 0 var(--pad) var(--pad);
  }

  .online :global(.online-list-rows) {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--gap);
    min-height: 0;
    padding: 0 calc(var(--pad) - var(--gap-md)) calc(var(--pad) - var(--gap-md));
  }

  .online-group {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .online-player {
    display: grid;
    grid-template-columns: 1.6em minmax(0, auto) auto minmax(0, 1fr);
    align-items: center;
    gap: var(--gap-md);
    min-height: var(--row-h);
    padding: var(--gap-xs) var(--gap-md);
    border-radius: var(--radius-sm);
  }

  .online-player[data-focused] {
    background: var(--row-on);
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: calc(var(--mark-w) * -1);
  }

  .online-flag {
    text-align: center;
  }

  .online-name {
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .online-end {
    display: flex;
    grid-column: -2;
    justify-content: flex-end;
  }

  /* :root lifts these over the old `.settings button` reset (0,1,1). */
  :root .online-join {
    height: var(--chip-h-in);
    padding: 0 var(--gap-md);
    border: 0;
    border-radius: var(--radius-full);
    background: var(--fill);
    color: var(--foreground);
    font: inherit;
    font-size: var(--type-small);
    font-weight: 700;
    cursor: pointer;
  }

  :root .online-join:hover {
    background: var(--row-on);
  }

  :root .online-join:focus-visible {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: var(--space-0);
  }

  .online-empty {
    margin: 0;
    padding: var(--gap-sm) var(--gap-md);
    text-wrap: pretty;
  }

  @media (max-height: 500px) {
    .online {
      grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
      align-items: start;
      height: auto;
    }

    .online :global(.online-room > .ui-card-pic) {
      flex: none;
      height: 5rem;
    }
  }

  /* Portrait: the room, then the players under it, each at its own height. */
  @media (orientation: portrait) and (max-width: 700px) {
    .online {
      grid-template-columns: minmax(0, 1fr);
      height: auto;
    }

    .online :global(.online-room > .ui-card-pic) {
      flex: none;
      aspect-ratio: 16 / 9;
    }
  }
</style>
