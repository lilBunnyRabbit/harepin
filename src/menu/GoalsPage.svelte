<script lang="ts">
  import { GOALS, type GoTo } from "../goals/goals";
  import { bare_enter } from "./drive-picks";
  import { hint_of } from "./goal-hint";
  import MenuFrame from "./MenuFrame.svelte";
  import Card from "./ui/Card.svelte";
  import Icon from "./ui/Icon.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import Progress from "./ui/Progress.svelte";
  import Row from "./ui/Row.svelte";
  import RowList from "./ui/RowList.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import "./events.css";

  interface Props extends PageProps {
    go: (to: GoTo) => void;
  }

  let { menu, live, shown, go }: Props = $props();

  const goals = $derived(menu.host.goals);
  const version = $derived(live.live(() => goals.version));
  const rows = $derived.by(() => {
    void version;
    return goals.sorted().map((goal) => {
      const done = goals.is_done(goal.id);
      const steps = done ? null : goals.steps(goal.id);
      const hint = hint_of(goal, live.prefs.bindings);
      return { goal, done, help: steps ? `${steps.done} / ${steps.total} · ${hint}` : hint };
    });
  });
  const done = $derived(rows.filter((row) => row.done).length);

  let picked = $state("");
  const row = $derived(rows.find((one) => one.goal.id === picked) ?? rows.find((one) => !one.done) ?? rows[0]);

  const open = () => row && go(row.goal.go);

  function key(event: KeyboardEvent) {
    if (!shown || event.defaultPrevented || !bare_enter(event)) return;
    event.preventDefault();
    open();
  }
</script>

<svelte:window onkeydown={key} />

{#snippet primary()}
  <PrimaryAction disabled={!row} onclick={open}>{row ? `Try: ${row.goal.title}` : "Try"}</PrimaryAction>
{/snippet}

<MenuFrame {menu} id="goals" eyebrow="Events" title="Things to try" veil={0.6} note="Nothing here is locked, and there is no order." {primary}>
  <div class="goals">
    <Card pad="sm" flat label="Progress">
      <div class="goals-bar">
        <div class="goals-text">
          <span class="ev-eyebrow">Things to try</span>
          <b class="ev-h2">{done} of {GOALS.length} tried</b>
        </div>
        <Progress value={done} max={GOALS.length} size="hero" label="Things tried" />
        {#if done === GOALS.length}<span class="goals-all"><Icon name="icon-check" />You've seen everything Harepin has</span>{/if}
      </div>
    </Card>
    <Card list class="goals-list" label="Things to try">
      <RowList label="Things to try">
        {#each rows as one (one.goal.id)}
          <Row label={one.goal.title} help={one.help} fill focused={one === row} onclick={() => ((picked = one.goal.id), go(one.goal.go))} onfocus={() => (picked = one.goal.id)}>
            {#snippet control()}
              {#if one.done}<span class="goals-done"><Icon name="icon-check" />Done</span>{:else}<span class="goals-go"><Icon name="icon-back" flip /></span>{/if}
            {/snippet}
          </Row>
        {/each}
      </RowList>
    </Card>
  </div>
</MenuFrame>

<style>
  .goals {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    justify-items: center;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .goals > :global(*) {
    width: min(760px, 100%);
  }

  .goals-bar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--pad);
  }

  .goals-text {
    display: grid;
    gap: var(--gap-xs);
  }

  .goals > :global(.goals-list) {
    align-self: start;
    max-height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .goals-done,
  .goals-all {
    --icon-size: 1.1em;
    display: inline-flex;
    align-items: center;
    gap: var(--gap-xs);
    color: var(--success);
    font-size: var(--type-small);
    font-weight: 700;
  }

  .goals-go {
    display: grid;
    color: var(--dim);
  }
</style>
