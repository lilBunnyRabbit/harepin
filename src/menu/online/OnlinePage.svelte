<script lang="ts">
  import Card from "../ui/Card.svelte";
  import Row from "../ui/Row.svelte";
  import RowList from "../ui/RowList.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import OnlineGames from "./OnlineGames.svelte";
  import OnlinePlayers from "./OnlinePlayers.svelte";
  import OnlineRace from "./OnlineRace.svelte";
  import OnlineRoom from "./OnlineRoom.svelte";

  let { menu, live, shown }: PageProps = $props();

  $effect(() => {
    if (!shown) return;
    menu.host.browse_servers(true);
    return () => menu.host.browse_servers(false);
  });
</script>

<div class="online-page">
  <div class="online-col">
    <OnlineRoom {menu} {live} />
    <OnlineRace {menu} {live} />
  </div>
  <div class="online-col">
    <OnlinePlayers {menu} {live} />
    <OnlineGames {menu} {live} />
    <Card class="online-new" list>
      <RowList>
        <Row label="New room" help="A fresh code, a map, an optional password" icon="icon-dice" onclick={() => menu.show("room")} />
      </RowList>
    </Card>
  </div>
</div>

<style>
  .online-page {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    align-items: start;
    gap: var(--space-5);
  }

  .online-col {
    display: grid;
    gap: var(--space-5);
    min-width: 0;
  }

  @media (max-width: 600px) {
    .online-page {
      grid-template-columns: minmax(0, 1fr);
    }

    .online-col {
      display: contents;
    }

    .online-page :global(.online-room) {
      order: 1;
    }

    .online-page :global(.online-players) {
      order: 2;
    }

    .online-page :global(.online-race) {
      order: 3;
    }

    .online-page :global(.online-games) {
      order: 4;
    }

    .online-page :global(.online-new) {
      order: 5;
    }
  }
</style>
