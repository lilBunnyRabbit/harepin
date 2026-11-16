<script lang="ts">
  import type { Snippet } from "svelte";
  import { tier_look } from "../../career/badge";
  import { MAX_EVENT_STARS } from "../../career/career";
  import type { TierBadge } from "../../net/net";
  import type { Reason } from "./types";

  const MAX_REASONS = 3;

  interface Props {
    tier: TierBadge;
    title: string;
    eyebrow?: string;
    /** Stars earned on the event, of `MAX_EVENT_STARS`; none draws no star row. */
    stars?: number;
    reasons?: readonly Reason[];
    size?: "docked" | "big";
    place?: Snippet;
  }

  let { tier, title, eyebrow, stars, reasons = [], size = "docked", place }: Props = $props();

  const edge = $derived(tier_look(tier).metal);
  const got = $derived(Math.min(MAX_EVENT_STARS, Math.max(0, stars ?? 0)));
</script>

<article class="ui-ticket" data-size={size} style:--tier={edge}>
  {#if eyebrow}<span class="ui-ticket-eyebrow">{eyebrow}</span>{/if}
  <div class="ui-ticket-title">
    <b>{title}</b>
    {#if place}{@render place()}{/if}
    {#if stars !== undefined}
      <span class="ui-ticket-stars" role="img" aria-label={`${got} of ${MAX_EVENT_STARS} stars`}>{"★".repeat(got)}<i>{"★".repeat(MAX_EVENT_STARS - got)}</i></span>
    {/if}
  </div>
  {#if reasons.length}
    <ul class="ui-ticket-reasons">
      {#each reasons.slice(0, MAX_REASONS) as reason, index (index)}
        <li>
          <span>{reason.text}</span>
          {#if reason.note}<small>{reason.note}</small>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</article>

<style>
  .ui-ticket {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--line);
    border-left: var(--space-1) solid var(--tier);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--foreground);
  }

  .ui-ticket-eyebrow {
    color: var(--dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .ui-ticket-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  }

  .ui-ticket-title b {
    font-size: var(--text-xl);
    line-height: 1.2;
  }

  .ui-ticket-stars {
    color: var(--accent);
    font-size: var(--text-md);
    letter-spacing: 0.15em;
  }

  .ui-ticket-stars i {
    color: var(--line-strong);
    font-style: normal;
  }

  .ui-ticket-reasons {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--dim);
    font-size: var(--text-md);
  }

  .ui-ticket-reasons li {
    display: grid;
  }

  .ui-ticket-reasons small {
    font-size: var(--text-sm);
  }

  [data-size="big"] {
    gap: var(--space-3);
    padding: var(--space-6) var(--space-8);
    border-left-width: var(--space-2);
  }

  [data-size="big"] .ui-ticket-title b {
    font-size: var(--text-3xl);
    font-weight: 800;
    line-height: 1.1;
  }

  [data-size="big"] .ui-ticket-reasons {
    gap: var(--space-4);
    color: var(--foreground);
    font-size: var(--text-lg);
    font-weight: 600;
  }

  [data-size="big"] .ui-ticket-reasons li {
    position: relative;
    padding-left: var(--space-5);
  }

  [data-size="big"] .ui-ticket-reasons li::before {
    content: "";
    position: absolute;
    top: 0.45em;
    left: 0;
    width: var(--space-2);
    height: var(--space-2);
    border-radius: 50%;
    background: var(--tier);
  }

  [data-size="big"] .ui-ticket-reasons small {
    color: var(--dim);
    font-weight: 500;
  }

  @media (max-height: 500px) {
    .ui-ticket {
      padding: var(--space-2) var(--space-3);
    }

    .ui-ticket-title b {
      font-size: var(--text-lg);
    }

    [data-size="big"] {
      padding: var(--space-4) var(--space-5);
    }

    [data-size="big"] .ui-ticket-title b {
      font-size: var(--text-2xl);
    }
  }
</style>
