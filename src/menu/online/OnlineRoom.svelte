<script lang="ts">
  import { NETWORK_BLOCKED, TURNED_AWAY, WRONG_PASSWORD } from "../../net/net";
  import { LOBBY_ROOM } from "../../net/room-name";
  import { world_query } from "../../world/world-pick";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import Row from "../ui/Row.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import { preview } from "../widgets";
  import { MEET_PAGE, drivers, room_name } from "./rooms";

  const NET_LABEL: Record<string, string> = {
    connecting: "Connecting",
    searching: "Searching for players",
    "local only": "Offline, this browser's tabs only",
    [WRONG_PASSWORD]: "Wrong password",
    [NETWORK_BLOCKED]: "Network blocked",
    [TURNED_AWAY]: "Searching, turned away a wrong password",
  };

  const BLOCKED_NOTE = "Found a player, but the network blocked the connection (mobile data often does). Try the same Wi-Fi.";

  interface Props extends Omit<PageProps, "shown"> {
    onretry?: () => void;
  }

  let { menu, live, onretry }: Props = $props();

  const { room, seed, kind, code } = $derived(menu.host);
  const lobby = $derived(room === LOBBY_ROOM);
  const map = $derived(live.live(() => menu.host.map_name()));
  const status = $derived(live.live(() => menu.host.net_status()));
  const here = $derived(live.live(() => menu.host.players()));
  const busy = $derived(live.live(() => menu.host.race_busy()));
  const versions = $derived(live.live(() => menu.host.version_peers()));
  const meet = $derived(live.live(meet_text));

  const tone = $derived(status === "online" ? "good" : status === "connecting" || status === "searching" || status === TURNED_AWAY ? "wait" : "bad");
  const version_text = $derived(
    [versions.older ? `${versions.older} on an older version` : "", versions.newer ? `${versions.newer} on a newer version, reload to update` : ""]
      .filter(Boolean)
      .join(" · "),
  );

  let confirming = $state(false);

  const leave = () => menu.go(world_query(LOBBY_ROOM, seed, kind, code));

  function ask_leave() {
    if (menu.host.race_busy() || menu.host.mode_running() !== null) confirming = true;
    else leave();
  }

  function meet_text(): string {
    const { host } = menu;
    if (!host.race_routes.length) return "No races on this map";
    if (host.race_busy()) return "A race is running";
    const { names, total } = host.ready_status();
    return total <= 1 ? "Race a route of this map" : names.length ? `${names.length} of ${total} ready` : "Nobody ready yet";
  }
</script>

{#snippet picture()}<img src={preview(kind)} alt="" />{/snippet}

<Card {picture} class="online-room" label="Your room">
  <header class="online-room-head">
    <span class="online-room-eyebrow">Your room · {room_name({ room })}</span>
    <h2>{map}</h2>
    <span class="online-room-sub" data-tone={tone}>{status === "online" ? `${drivers(here)} · ${busy ? "racing" : "roaming"}` : (NET_LABEL[status] ?? status)}</span>
    {#if status === NETWORK_BLOCKED}<small class="online-room-note">{BLOCKED_NOTE}</small>{/if}
    {#if version_text}<small class="online-room-note">{version_text}</small>{/if}
  </header>
  {#if onretry}
    <Row fill label="Wrong password" help="This room did not let you in" onclick={onretry} />
  {:else}
    <Row fill label="Race meet" help={meet} onclick={() => menu.show(MEET_PAGE)} />
  {/if}
  {#if confirming}
    <div class="online-room-confirm">
      <span>Leaving ends your race or run.</span>
      <span class="online-room-pair">
        <Button variant="danger" size="sm" onclick={leave}>Leave anyway</Button>
        <Button size="sm" onclick={() => (confirming = false)}>Stay</Button>
      </span>
    </div>
  {:else if !lobby}
    <span class="online-room-leave"><Button variant="quiet" size="sm" onclick={ask_leave}>Leave room</Button></span>
  {/if}
</Card>

<style>
  .online-room-head {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .online-room-eyebrow {
    overflow: hidden;
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  h2 {
    margin: 0;
    font-size: var(--type-h2);
    font-weight: 800;
    line-height: 1.15;
    text-wrap: balance;
  }

  .online-room-sub {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .online-room-sub::before {
    content: "";
    flex: none;
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
    background: var(--success);
  }

  .online-room-sub[data-tone="wait"]::before {
    background: var(--warning);
  }

  .online-room-sub[data-tone="bad"]::before {
    background: var(--error);
  }

  .online-room-note {
    color: var(--dim);
    font-size: var(--type-small);
    line-height: 1.4;
    text-wrap: pretty;
  }

  .online-room-confirm {
    display: grid;
    gap: var(--gap-sm);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .online-room-pair,
  .online-room-leave {
    display: flex;
    gap: var(--gap-sm);
  }
</style>
