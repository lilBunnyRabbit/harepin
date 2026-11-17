<script lang="ts">
  import Glyph from "../menu/ui/Glyph.svelte";
  import Icon from "../menu/ui/Icon.svelte";
  import KeyLink from "../menu/ui/KeyLink.svelte";
  import PageFrame from "../menu/ui/PageFrame.svelte";
  import PrimaryAction from "../menu/ui/PrimaryAction.svelte";
  import PauseAids from "./PauseAids.svelte";
  import { ROWS, type PauseKeys } from "./pause-keys";
  import type { PauseAct, PauseAid, PauseAids as Aids, PauseCard } from "./pause-view.svelte";

  const VEIL = 0.55;

  interface Props {
    card: PauseCard;
    aids: Aids;
    solo: boolean;
    caps: PauseKeys["caps"];
    onact: (act: PauseAct) => void;
    onflip: (aid: PauseAid) => void;
    onresume: () => void;
  }

  let { card, aids, solo, caps, onact, onflip, onresume }: Props = $props();

  const rows = $derived(ROWS[card.kind]);
  const [lead, ...rest] = $derived(card.facts);
</script>

<PageFrame eyebrow={card.context} title={solo ? "Paused" : "Menu"} veil={VEIL}>
  <div class="pause-body">
    <section class="pause-panel" aria-label={card.kind === "roam" ? "Free roam" : "This run"}>
      <div class="pause-run">
        <div class="pause-now">
          <div class="pause-what">
            <span class="pause-eyebrow">{card.title}</span>
            {#if lead}<b class="pause-lead">{lead}</b>{/if}
            {#if rest.length}<span class="pause-facts">{rest.join(" · ")}</span>{/if}
          </div>
          {#if card.clock}<b class="pause-clock">{card.clock}</b>{/if}
        </div>
        <div class="pause-acts">
          {#each rows.acts as row (row.act)}
            <button type="button" class="pause-act" onclick={() => onact(row.act)}><Glyph key={caps[row.act]} /><span>{row.label}</span></button>
          {/each}
        </div>
      </div>

      <PauseAids {aids} {onflip} />

      <nav class="pause-go" aria-label="Go to">
        <span class="pause-eyebrow">Go to</span>
        <div class="pause-doors">
          {#each rows.doors as row (row.act)}
            <button type="button" class="pause-door" onclick={() => onact(row.act)}>
              <span>{row.label}</span>
              <Glyph key={caps[row.act]} />
              <Icon name="icon-back" flip />
            </button>
          {/each}
        </div>
      </nav>
    </section>
  </div>

  {#snippet links()}
    <KeyLink keys={{ key: caps.camera }} onclick={() => onact("camera")}>Camera</KeyLink>
    <KeyLink keys={{ key: caps.chat }} onclick={() => onact("chat")}>Chat</KeyLink>
  {/snippet}
  {#snippet primary()}
    <PrimaryAction keys={{ key: "Enter", pad: "A", touch: "icon-play" }} onclick={onresume}>Resume</PrimaryAction>
  {/snippet}
</PageFrame>

<style>
  .pause-body {
    display: grid;
    grid-template-columns: minmax(0, 25rem);
    align-items: start;
    height: 100%;
    pointer-events: none;
  }

  .pause-panel {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    padding: var(--pad);
    border: 1px solid var(--line-strong);
    border-radius: var(--card-radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    pointer-events: auto;
  }

  .pause-run,
  .pause-go {
    display: grid;
    gap: var(--gap-sm);
    min-width: 0;
  }

  .pause-now {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-md);
    padding: var(--gap-sm) var(--gap-md);
    border-radius: var(--radius-sm);
    background: var(--row);
  }

  .pause-what {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .pause-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .pause-lead {
    font-size: var(--type-h3);
    font-weight: 800;
    line-height: 1.15;
  }

  .pause-facts {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .pause-clock {
    flex: none;
    font: 800 var(--type-h2) / 1 var(--font-mono);
  }

  .pause-acts {
    display: flex;
    gap: var(--gap-sm);
  }

  /* :root lifts these over the base button rules. */
  :root .pause-act,
  :root .pause-door {
    border: 0;
    color: var(--foreground);
    font: 700 var(--type-body) / 1.2 var(--font-sans);
    cursor: pointer;
  }

  :root .pause-act {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: var(--gap-sm);
    height: var(--top-h);
    padding: 0 var(--gap);
    border-radius: var(--radius-full);
    background: var(--fill);
    white-space: nowrap;
  }

  .pause-doors {
    display: grid;
    gap: var(--gap-xs);
  }

  :root .pause-door {
    --icon-size: 1.15em;
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    min-height: var(--row-h);
    padding: var(--gap-sm) var(--gap-md);
    border-radius: var(--radius-sm);
    background: var(--row);
    text-align: left;
  }

  .pause-door span {
    flex: 1;
    min-width: 0;
  }

  .pause-door :global(.ui-icon),
  .pause-door :global(.ui-cap) {
    color: var(--dim);
  }

  :root :is(.pause-act, .pause-door):hover {
    background: var(--row-on);
  }

  :root :is(.pause-act, .pause-door):focus-visible {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: calc(var(--mark-w) * -1);
    background: var(--row-on);
  }

  @media (max-height: 500px) {
    .pause-body {
      grid-template-columns: minmax(0, 30rem);
    }

    .pause-panel {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--gap-md) var(--gap);
    }

    .pause-go {
      grid-column: 1 / -1;
    }

    .pause-doors {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--gap-sm);
    }
  }
</style>
