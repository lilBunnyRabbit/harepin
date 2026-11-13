<script lang="ts">
  import { MAX_EVENT_STARS, TIERS, tier_max, tier_open, tier_stars, type Tier } from "../career/career";
  import { owner_times } from "../career/career-store";
  import { tier_badge } from "../career/badge";
  import { badge_open } from "../career/rewards";
  import { run_text } from "../modes/result";
  import type { TierBadge } from "../net/net";
  import CarLimit from "./CarLimit.svelte";
  import { event_note } from "./career-text";
  import Badge from "./ui/Badge.svelte";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";
  import Icon from "./ui/Icon.svelte";
  import Progress from "./ui/Progress.svelte";
  import Row from "./ui/Row.svelte";
  import RowList from "./ui/RowList.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { COPIED_MS } from "./widgets";

  interface Props extends PageProps {
    /** `?tune`: the owner sets the non-race events' stars from their own runs. */
    tune: boolean;
  }

  let { menu, live, tune }: Props = $props();

  const career = $derived(menu.host.career);
  let copied = $state("");

  async function copy_times() {
    try {
      await navigator.clipboard.writeText(owner_times(career));
      copied = "Copied";
    } catch (error) {
      console.warn("settings: clipboard refused", error);
      copied = "Copy failed";
    }
    setTimeout(() => (copied = ""), COPIED_MS);
  }

  const shield = (tier: Tier) => (node: HTMLElement) => {
    node.replaceChildren(tier_badge((TIERS.indexOf(tier) + 1) as TierBadge));
  };
</script>

<div class="career">
  {#if tune}
    <div class="tune"><Button onclick={copy_times}>{copied || "Copy my times"}</Button></div>
  {/if}

  {#each TIERS as tier, index (tier.id)}
    {@const open = tune || tier_open(live.stars, tier)}
    {@const have = tier_stars(live.stars, tier)}
    {@const before = TIERS[index - 1]}
    <Card list label={tier.name}>
      <div class="head">
        <SectionHead title={tier.name} count={`${have} / ${tier_max(tier)} ★`}>
          {#snippet action()}
            {#if !open && before}
              <span class="lock"><Icon name="icon-lock" />{tier.opens_at} ★ in {before.name}</span>
            {:else if badge_open(live.stars, tier)}
              <span class="shield" {@attach shield(tier)}></span>
            {/if}
          {/snippet}
        </SectionHead>
        <Progress value={have} max={tier_max(tier)} label={`${have} of ${tier_max(tier)} stars in ${tier.name}`} />
      </div>
      <div class:locked={!open}>
      <RowList divided label={`${tier.name} events`}>
        {#each tier.events as event (event.id)}
          {@const got = live.stars[event.id] ?? 0}
          {@const best = live.live(() => career.best(event))}
          <Row label={event.name} help={`${event.id.toUpperCase()} · ${event_note(event)}`}>
            {#snippet control()}
              <span class="end">
                {#if event.final}<Badge>Final</Badge>{/if}
                <CarLimit {event} />
                <span class="result">
                  <span class="star-row" aria-label={`${got} of ${MAX_EVENT_STARS} stars`}>{"★".repeat(got)}<i>{"★".repeat(MAX_EVENT_STARS - got)}</i></span>
                  {#if best}<small>{run_text(best)}</small>{/if}
                </span>
                <Button size="sm" disabled={!open} aria-label={`Go: ${event.name}`} onclick={() => menu.host.start_event(event.id)}>Go</Button>
              </span>
            {/snippet}
          </Row>
        {/each}
      </RowList>
      </div>
    </Card>
  {/each}
</div>

<style>
  .career {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr));
    align-items: start;
    gap: var(--space-5);
  }

  .tune {
    grid-column: 1 / -1;
  }

  .head {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-4) var(--space-2);
  }

  .lock {
    --icon-size: var(--text-lg);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--set-dim);
    font-size: var(--text-md);
    font-weight: 600;
  }

  .shield {
    display: flex;
    font-size: var(--text-lg);
  }

  .end {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .result {
    display: grid;
    justify-items: end;
    min-width: 5.5em;
    font-variant-numeric: tabular-nums;
  }

  .result small {
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .star-row {
    color: var(--accent);
    letter-spacing: 0.15em;
  }

  .star-row i {
    color: var(--line-strong);
    font-style: normal;
  }

  .locked {
    opacity: 0.6;
  }

  :global(.settings[data-view="page"] .settings-page[data-section="career"]) {
    max-width: none;
    padding: 0;
    border: 0;
    background: none;
  }

  @media (max-width: 600px) {
    .end {
      flex-direction: column;
      align-items: end;
      gap: var(--space-2);
    }
  }
</style>
