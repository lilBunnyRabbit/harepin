<script lang="ts">
  import { daily } from "../../runs/runs";
  import type { Menu } from "../page";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import type { MenuState } from "../ui/menu-state.svelte";
  import { pick_text } from "./run-text";

  interface Props {
    menu: Menu;
    live: MenuState;
  }

  let { menu, live }: Props = $props();

  const runs = $derived(menu.host.runs);
  const today = $derived(live.live(() => runs.today));
  const pick = $derived(daily(today));
  const got = $derived(live.live(() => runs.daily(today)));
  const season = $derived(live.live(() => runs.stars));
</script>

<Card variant="well" label="Runs">
  <div class="runs-card">
    <SectionHead eyebrow="Runs" title={`Daily · ${pick_text(pick)}`}>
      {#snippet action()}
        <Button onclick={() => menu.show("runs")}>Open</Button>
      {/snippet}
    </SectionHead>
    <p>{got} / 3 ★ today · season {season} ★ · endless and your own events</p>
  </div>
</Card>

<style>
  .runs-card {
    display: grid;
    gap: var(--space-2);
  }

  p {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }
</style>
