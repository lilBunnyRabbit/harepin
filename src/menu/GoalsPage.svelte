<script lang="ts">
  import { GOALS, type GoTo } from "../goals/goals";
  import { hint_of } from "./goal-hint";
  import Badge from "./ui/Badge.svelte";
  import Button from "./ui/Button.svelte";
  import Icon from "./ui/Icon.svelte";
  import Progress from "./ui/Progress.svelte";
  import Row from "./ui/Row.svelte";
  import RowList from "./ui/RowList.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  interface Props extends PageProps {
    go: (to: GoTo) => void;
  }

  let { menu, live, go }: Props = $props();

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
</script>

<div class="goals-page">
  <div class="goals-summary">
    <SectionHead eyebrow="Progress" title={`${done} of ${GOALS.length} tried`} />
    <Progress value={done} max={GOALS.length} label="Things tried" />
    <p class="goals-lead">Nothing here is locked. These are the things Harepin has, in no particular order.</p>
    {#if done === GOALS.length}
      <p class="goals-all"><Icon name="icon-check" />All {done} tried: you've seen everything Harepin has.</p>
    {/if}
  </div>
  <RowList divided label="Things to try">
    {#each rows as row (row.goal.id)}
      <Row label={row.goal.title} help={row.help}>
        {#snippet control()}
          {#if row.done}
            <Badge tone="success">Done</Badge>
          {:else}
            <Button size="sm" aria-label={`Go: ${row.goal.title}`} onclick={() => go(row.goal.go)}>Go</Button>
          {/if}
        {/snippet}
      </Row>
    {/each}
  </RowList>
</div>

<style>
  .goals-page {
    display: grid;
    gap: var(--space-5);
  }

  .goals-summary {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4) 0;
  }

  .goals-lead {
    margin: 0;
    max-width: 60ch;
    color: var(--set-dim);
    font-size: var(--text-md);
    line-height: 1.45;
    text-wrap: pretty;
  }

  .goals-all {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    color: var(--success);
    font-size: var(--text-lg);
    font-weight: 600;
  }
</style>
