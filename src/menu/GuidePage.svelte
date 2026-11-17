<script lang="ts">
  import { GOALS, GoalId } from "../goals/goals";
  import { bare_enter } from "./drive-picks";
  import { GOALS_PAGE, GUIDE_PAGE, TOPICS, line_of, type Topic } from "./guide-topics";
  import MenuFrame from "./MenuFrame.svelte";
  import Card from "./ui/Card.svelte";
  import Icon from "./ui/Icon.svelte";
  import KeyLink from "./ui/KeyLink.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import Progress from "./ui/Progress.svelte";
  import Row from "./ui/Row.svelte";
  import RowList from "./ui/RowList.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { preview } from "./widgets";
  import "./events.css";

  interface Props extends PageProps {
    open: (id: string) => void;
  }

  let { menu, live, shown, open }: Props = $props();

  const goals = $derived(menu.host.goals);
  const version = $derived(live.live(() => goals.version));
  const done = $derived.by(() => (void version, goals.count));
  const next = $derived.by(() => (void version, GOALS.find((goal) => !goals.is_done(goal.id))));
  const first_run = $derived.by(() => (void version, !goals.is_done(GoalId.FLAG)));

  const STEPS = "steps";
  let picked = $state<string>(TOPICS[0].id);
  let reading = $state<string | null>(null);
  const topic = $derived(TOPICS.find((one) => one.id === reading) ?? null);
  const focus = $derived(TOPICS.find((one) => one.id === picked) ?? TOPICS[0]);

  export function back(): boolean {
    if (!reading) return false;
    reading = null;
    return true;
  }

  // A topic's door leads back here on Back: the topic stays open behind it.
  let through_door = false;

  $effect(() => {
    if (!shown) return;
    return () => {
      if (!through_door) reading = null;
      through_door = false;
    };
  });

  function enter(one: Topic) {
    picked = one.id;
    if (one.points.length) reading = one.id;
    else open(one.door);
  }

  function act() {
    if (topic) {
      through_door = true;
      open(topic.door);
    } else if (picked === STEPS) open(GOALS_PAGE);
    else enter(focus);
  }

  function skip_first_run() {
    goals.skip(GoalId.FLAG);
    menu.refresh();
  }

  function key(event: KeyboardEvent) {
    if (!shown || event.defaultPrevented || !bare_enter(event)) return;
    event.preventDefault();
    act();
  }
</script>

<svelte:window onkeydown={key} />

{#snippet links()}
  {#if first_run}<KeyLink onclick={skip_first_run}>Skip the first run</KeyLink>{/if}
{/snippet}

{#snippet primary()}
  <PrimaryAction onclick={act}>{topic ? topic.verb : `Open ${picked === STEPS ? "First steps" : focus.title}`}</PrimaryAction>
{/snippet}

{#if topic}
  <MenuFrame {menu} id={GUIDE_PAGE} eyebrow="Guide" title={topic.title} season={false} veil={0.6} back_to="Guide" {primary}>
    <div class="guide-topic">
      <Card list class="guide-points" label={topic.title}>
        <RowList divided label={topic.title}>
          {#each topic.points as point (point.label)}
            <Row label={point.label} help={line_of(point, live.prefs.bindings)} />
          {/each}
        </RowList>
      </Card>
      <Card pad="none" flat class="guide-shot" label="Picture">
        <img class="ev-pic" src={preview(topic.art)} alt="" />
      </Card>
    </div>
  </MenuFrame>
{:else}
  <MenuFrame {menu} id={GUIDE_PAGE} eyebrow="Settings" title="Guide" season={false} veil={0.6} {links} {primary}>
    <div class="guide">
      <Card pad="sm" flat class="guide-steps" focused={picked === STEPS} onclick={() => ((picked = STEPS), open(GOALS_PAGE))} onfocus={() => (picked = STEPS)} label="First steps">
        <span class="guide-bar">
          <span class="guide-text">
            <span class="ev-eyebrow">First steps</span>
            <b class="ev-h2">{done} of {GOALS.length} done</b>
          </span>
          <Progress value={done} max={GOALS.length} size="hero" label="First steps done" />
          <span class="guide-text guide-next">
            {#if next}
              <span class="ev-eyebrow">Next step</span>
              <b class="ev-nowrap">{next.title}</b>
            {:else}
              <span class="guide-all"><Icon name="icon-check" />All done</span>
            {/if}
          </span>
          <span class="guide-go"><Icon name="icon-back" flip /></span>
        </span>
      </Card>
      {#each TOPICS as one (one.id)}
        {#snippet shot()}
          <img class="ev-pic" src={preview(one.art)} alt="" />
        {/snippet}
        <Card picture={shot} flat focused={one.id === picked} class="guide-card" onclick={() => ((picked = one.id), enter(one))} onfocus={() => (picked = one.id)} label={one.title}>
          <b class="ev-h3">{one.title}</b>
          <span class="ev-small">{one.line}</span>
        </Card>
      {/each}
    </div>
  </MenuFrame>
{/if}

<style>
  .guide {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .guide > :global(.guide-steps) {
    grid-column: 1 / -1;
  }

  .guide-bar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--pad);
  }

  .guide-text {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .guide-next {
    text-align: right;
  }

  .guide-all {
    --icon-size: 1.1em;
    display: inline-flex;
    align-items: center;
    gap: var(--gap-xs);
    color: var(--success);
    font-weight: 700;
  }

  .guide-go {
    --icon-size: 1.4em;
    display: grid;
    flex: none;
    color: var(--dim);
  }

  .guide-topic {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .guide-topic > :global(.guide-points) {
    align-self: start;
    max-height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .guide-topic > :global(.guide-shot) {
    overflow: hidden;
  }

  @media (max-height: 500px) {
    /* The phone body scrolls, so it clips: the focus ring needs its room inside. */
    .guide,
    .guide-topic {
      height: auto;
      padding: calc(var(--mark-w) + var(--space-0));
    }

    .guide {
      grid-template-rows: auto;
      grid-auto-rows: 9rem;
    }

    .guide-topic > :global(.guide-points) {
      max-height: none;
    }

    .guide-topic > :global(.guide-shot) {
      align-self: start;
      aspect-ratio: 16 / 10;
    }
  }

  /* Portrait: two topics a row, and a topic's points over its picture. */
  @media (max-width: 700px) {
    .guide,
    .guide-topic {
      height: auto;
    }

    .guide {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: auto;
      grid-auto-rows: calc(var(--top-h) * 5);
    }

    .guide-topic {
      grid-template-columns: minmax(0, 1fr);
    }

    .guide-topic > :global(.guide-points) {
      max-height: none;
    }

    .guide-topic > :global(.guide-shot) {
      aspect-ratio: 16 / 10;
    }
  }
</style>
