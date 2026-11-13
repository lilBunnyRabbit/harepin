<script lang="ts">
  import { tier_badge } from "../../career/badge";
  import { country_name, flag } from "../../net/country";
  import type { Announce } from "../../net/directory";
  import { ping_class, type Player } from "../../net/players";
  import { LOBBY_ROOM } from "../../net/room-name";
  import { kind_of_world } from "../../worldgen/kinds/kinds";
  import { WORLDS } from "../../worlds/worlds";
  import Badge from "../ui/Badge.svelte";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import Row from "../ui/Row.svelte";
  import RowList from "../ui/RowList.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import Dot from "./Dot.svelte";
  import { join_game } from "./join";
  import UnlockForm from "./UnlockForm.svelte";

  const NOTE = {
    connecting: "Looking for players…",
    online: "Everyone in a game right now",
    offline: "No other games found. Invite links still work.",
  };

  let { menu, live }: Omit<PageProps, "shown"> = $props();

  const players = $derived(live.live(() => menu.host.players_online()));
  const note = $derived(NOTE[live.live(() => menu.host.servers_status())]);

  let asking = $state<Announce | null>(null);

  function join(game: Announce) {
    if (game.locked) asking = game;
    else join_game(menu, game, null);
  }

  function place(player: Player): string {
    const { game } = player;
    const map = `${WORLDS[kind_of_world(game.world)].name} ${game.map ?? game.seed}`;
    const parts = player.country ? [`${flag(player.country)} ${country_name(player.country)}`] : [];
    if (game.room === LOBBY_ROOM) parts.push(`Free roam · ${map}`);
    else parts.push(game.locked ? `${game.room}, locked` : game.room, map);
    if (player.racing) parts.push("racing");
    return parts.join(" · ");
  }

  function tag(player: Player): string | null {
    if (player.you) return "You";
    if (player.game.here) return "Here";
    if (player.racing) return "Racing";
    if (player.game.version !== menu.host.version) return "Different version";
    return null;
  }

  const TONE = { good: "good", ok: "wait", bad: "bad", none: "none" } as const;
</script>

<Card class="online-players">
  <SectionHead title="Players online" count={players.length || undefined} />
  <p class="players-note">{note}</p>
  {#if asking}
    {#key asking}<UnlockForm {menu} target={asking} oncancel={() => (asking = null)} />{/key}
  {:else if players.length}
    <div class="players-well">
      <RowList divided label="Players online">
        {#each players as player (player.key)}
          {@const label = tag(player)}
          <Row label={player.name} help={place(player)}>
            {#snippet control()}
              <span class="players-end">
                {#if player.tier}<span class="players-tier" {@attach (node) => node.replaceChildren(tier_badge(player.tier!))}></span>{/if}
                {#if !player.game.here}
                  <span class="players-ping"><Dot tone={TONE[ping_class(player.ping)]}>{player.ping === null ? "–" : `${player.ping} ms`}</Dot></span>
                {/if}
                {#if label}<Badge>{label}</Badge>{:else}<Button size="sm" onclick={() => join(player.game)}>Join</Button>{/if}
              </span>
            {/snippet}
          </Row>
        {/each}
      </RowList>
    </div>
  {/if}
</Card>

<style>
  .players-note {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .players-well {
    border-radius: var(--radius-md);
    background: var(--set-soft);
  }

  .players-end {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .players-tier {
    display: flex;
  }

  .players-ping {
    color: var(--set-dim);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  @media (max-width: 600px) {
    .players-end {
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-2);
    }
  }
</style>
