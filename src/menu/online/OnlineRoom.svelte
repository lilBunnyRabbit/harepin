<script lang="ts">
  import { NETWORK_BLOCKED, TURNED_AWAY, WRONG_PASSWORD } from "../../net/net";
  import { LOBBY_ROOM } from "../../net/room-name";
  import { world_query } from "../../world/world-pick";
  import { WORLDS } from "../../worlds/worlds";
  import { invite_link } from "../page";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import { COPIED_MS } from "../widgets";
  import Dot from "./Dot.svelte";

  const NET_LABEL: Record<string, string> = {
    connecting: "Connecting",
    searching: "Searching for players",
    "local only": "Offline, this browser's tabs only",
    [WRONG_PASSWORD]: "Wrong password",
    [NETWORK_BLOCKED]: "Network blocked",
    [TURNED_AWAY]: "Searching, turned away a wrong password",
  };

  const BLOCKED_NOTE = "Found a player, but the network blocked the connection (mobile data often does). Try the same Wi-Fi.";
  const COPY = "Copy invite link";

  let { menu, live }: Omit<PageProps, "shown"> = $props();

  const { room, seed, kind, code } = $derived(menu.host);
  const lobby = $derived(room === LOBBY_ROOM);
  const link = $derived(invite_link(room, seed, kind, code));

  const status = $derived(live.live(() => menu.host.net_status()));
  const peers = $derived(live.live(() => menu.host.peers()));
  const here = $derived(live.live(() => menu.host.players()));
  const versions = $derived(live.live(() => menu.host.version_peers()));

  const status_text = $derived(status === "online" ? `Online · ${peers} ${peers === 1 ? "player" : "players"} connected` : (NET_LABEL[status] ?? status));
  const tone = $derived(status === "online" ? "good" : status === "connecting" || status === "searching" ? "wait" : status === TURNED_AWAY ? "none" : "bad");
  const version_text = $derived(
    [versions.older ? `${versions.older} on an older version` : "", versions.newer ? `${versions.newer} on a newer version, reload to update` : ""]
      .filter(Boolean)
      .join(" · "),
  );

  let copy_label = $state(COPY);
  let confirming = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      copy_label = "Copied";
    } catch (error) {
      console.warn("settings: clipboard refused", error);
      copy_label = "Copy failed";
    }
    setTimeout(() => (copy_label = COPY), COPIED_MS);
  }

  const leave = () => menu.go(world_query(LOBBY_ROOM, seed, kind, code));

  function ask_leave() {
    if (menu.host.race_busy() || menu.host.mode_running() !== null) confirming = true;
    else leave();
  }
</script>

<Card class="online-room">
  <SectionHead eyebrow="Your room" title={room} role="page" />
  <div class="room-status">
    <span class="room-net"><Dot {tone}>{status_text}</Dot></span>
    <small class="room-dim">{here} here · {WORLDS[kind].name} {seed}</small>
    {#if status === NETWORK_BLOCKED}<small class="room-dim room-note">{BLOCKED_NOTE}</small>{/if}
    {#if version_text}<small class="room-dim room-note">{version_text}</small>{/if}
  </div>
  <div class="room-actions">
    <Button variant="primary" size="lg" icon="icon-share" onclick={copy}>{copy_label}</Button>
    {#if !lobby}<Button size="lg" onclick={ask_leave}>Leave room</Button>{/if}
  </div>
  {#if confirming}
    <div class="room-confirm">
      <span>Leaving ends your race or run.</span>
      <div class="room-actions">
        <Button variant="danger" onclick={leave}>Leave anyway</Button>
        <Button onclick={() => (confirming = false)}>Stay</Button>
      </div>
    </div>
  {/if}
  <small class="room-dim">Friends who open the link join this room on this map</small>
</Card>

<style>
  .room-status {
    display: grid;
    gap: var(--space-1);
  }

  .room-net {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .room-dim {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    text-wrap: pretty;
  }

  .room-note {
    max-width: 48ch;
  }

  .room-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding-top: var(--space-2);
  }

  .room-confirm {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--set-soft);
  }

  .room-confirm .room-actions {
    padding-top: 0;
  }
</style>
