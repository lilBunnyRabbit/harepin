<script lang="ts">
  import type { Announce, Server } from "../../net/directory";
  import Badge from "../ui/Badge.svelte";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import Icon from "../ui/Icon.svelte";
  import Row from "../ui/Row.svelte";
  import RowList from "../ui/RowList.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import { join_game } from "./join";
  import UnlockForm from "./UnlockForm.svelte";

  let { menu, live }: Omit<PageProps, "shown"> = $props();

  const servers = $derived(live.live(() => menu.host.servers()));
  const failed = $derived(live.live(() => menu.host.password_failed()));

  let asking = $state<Announce | null>(null);

  function join(server: Server) {
    if (server.locked) asking = server;
    else join_game(menu, server, null);
  }
</script>

{#snippet lock()}<span class="games-lock" role="img" aria-label="Locked"><Icon name="icon-lock" /></span>{/snippet}

<!-- The players card says why the list is empty; an empty card here would only repeat it. -->
{#if servers.length}
  <Card class="online-games">
    <SectionHead title="Games running" count={servers.length} />
    {#if asking}
      {#key asking}<UnlockForm {menu} target={asking} oncancel={() => (asking = null)} />{/key}
    {:else}
      <div class="games-well">
        <RowList divided label="Games running">
          {#each servers as server (server.key)}
            <Row label={server.room} help={`${server.host} · map ${server.seed}`} icon="icon-globe" badge={server.locked ? lock : undefined}>
              {#snippet control()}
                <span class="games-end">
                  <span class="games-count">{server.players} {server.players === 1 ? "player" : "players"}</span>
                  {#if server.here && server.locked && failed}
                    <Button size="sm" onclick={() => (asking = server)}>Retry password</Button>
                  {:else if server.here}
                    <Badge>You're here</Badge>
                  {:else if server.version !== menu.host.version}
                    <Badge>Different version</Badge>
                  {:else}
                    <Button size="sm" onclick={() => join(server)}>Join</Button>
                  {/if}
                </span>
              {/snippet}
            </Row>
          {/each}
        </RowList>
      </div>
    {/if}
  </Card>
{/if}

<style>
  .games-well {
    border-radius: var(--radius-md);
    background: var(--set-soft);
  }

  .games-end {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .games-lock {
    --icon-size: var(--text-lg);
    display: flex;
    color: var(--set-dim);
  }

  .games-count {
    color: var(--set-dim);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  @media (max-width: 600px) {
    .games-end {
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-2);
    }
  }
</style>
