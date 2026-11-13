<script lang="ts">
  import { GOALS, type GoTo } from "../goals/goals";
  import { hint_of } from "./goal-hint";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";
  import Icon from "./ui/Icon.svelte";
  import Link from "./ui/Link.svelte";
  import Progress from "./ui/Progress.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  interface Props extends Omit<PageProps, "shown"> {
    go: (to: GoTo) => void;
  }

  let { menu, live, go }: Props = $props();

  const goals = $derived(menu.host.goals);
  const version = $derived(live.live(() => goals.version));
  const done = $derived((void version, goals.count));
  const next = $derived((void version, goals.sorted().find((goal) => !goals.is_done(goal.id))));
</script>

<Card class="goals-card" label="Things to try">
  <SectionHead eyebrow="Things to try" title={`${done} of ${GOALS.length} tried`}>
    {#snippet action()}<Link chevron onclick={() => menu.show("goals")}>See all</Link>{/snippet}
  </SectionHead>
  <Progress value={done} max={GOALS.length} label="Things tried" />
  {#if next}
    <div class="goals-next">
      <span class="goals-text">
        <b>{next.title}</b>
        <small>{hint_of(next, live.prefs.bindings)}</small>
      </span>
      <Button size="sm" aria-label={`Go: ${next.title}`} onclick={() => go(next.go)}>Go</Button>
    </div>
  {:else}
    <p class="goals-finished"><Icon name="icon-check" />All {done} tried: you've seen everything Harepin has.</p>
  {/if}
</Card>

<style>
  .goals-next {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .goals-text {
    display: grid;
    flex: 1;
    gap: var(--space-0);
    min-width: 0;
  }

  .goals-text b {
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.3;
  }

  .goals-text small {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    text-wrap: pretty;
  }

  .goals-finished {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    color: var(--success);
    font-size: var(--text-md);
    font-weight: 600;
  }
</style>
