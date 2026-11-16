<script lang="ts">
  import Glyph from "../menu/ui/Glyph.svelte";
  import Icon from "../menu/ui/Icon.svelte";
  import IconButton from "../menu/ui/IconButton.svelte";
  import KeyButton from "../menu/ui/KeyButton.svelte";
  import PauseAids from "./PauseAids.svelte";
  import type { PauseAct, PauseAid, PauseAids as Aids, RunCard } from "./pause-view.svelte";

  interface Props {
    card: RunCard;
    aids: Aids;
    solo: boolean;
    onact: (act: PauseAct) => void;
    onflip: (aid: PauseAid) => void;
    onresume: () => void;
  }

  let { card, aids, solo, onact, onflip, onresume }: Props = $props();

  const ROWS: readonly { act: PauseAct; label: string; icon: string; key: string }[] = [
    { act: "reset", label: "Restart", icon: "icon-restart", key: "R" },
    { act: "garage", label: "Car and parts", icon: "icon-car", key: "G" },
    { act: "leave", label: "Leave event", icon: "icon-close", key: "L" },
    { act: "showroom", label: "Showroom", icon: "logo-mark", key: "M" },
    { act: "settings", label: "Settings", icon: "icon-settings", key: "O" },
  ];
</script>

<div class="run">
  <section class="run-card" aria-label="This run">
    <span class="run-eyebrow">{solo ? "Paused" : "Menu"} · {card.mode}</span>
    <b>{card.title}</b>
    {#if card.facts.length}
      <span class="run-facts">
        {#each card.facts as fact, index (index)}<span>{fact}</span>{/each}
      </span>
    {/if}
  </section>

  <nav class="run-rows" aria-label="Run">
    {#each ROWS as row (row.act)}
      <button type="button" class="run-row" onclick={() => onact(row.act)}>
        <Icon name={row.icon} />
        <span>{row.label}</span>
        <Glyph key={row.key} />
      </button>
    {/each}
  </nav>

  <div class="run-more">
    <PauseAids {aids} {onflip} />
    <div class="run-tools">
      <IconButton class="run-tool" icon="icon-camera" label="Camera" title="Camera (C)" onclick={() => onact("camera")} />
      <IconButton class="run-tool" icon="icon-chat" label="Chat" title="Chat (T)" onclick={() => onact("chat")} />
    </div>
  </div>

  <!-- svelte-ignore a11y_autofocus -->
  <KeyButton class="run-resume" size="lg" keys={{ key: "Enter", pad: "B", touch: "icon-play" }} onclick={onresume} autofocus>Resume</KeyButton>
</div>

<style>
  .run {
    display: grid;
    grid-template: "card ." auto "rows ." auto "more more" auto ". ." 1fr ". resume" auto / minmax(0, 26rem) 1fr;
    gap: var(--space-4);
    height: 100%;
  }

  .run-card {
    grid-area: card;
    display: grid;
    gap: var(--space-1);
    margin-bottom: var(--space-8);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .run-card b {
    font-size: var(--text-3xl);
    font-weight: 800;
    line-height: 1.15;
  }

  .run-eyebrow {
    color: var(--dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .run-facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    color: var(--dim);
    font-size: var(--text-lg);
  }

  .run-facts span:first-child {
    color: var(--foreground);
    font-weight: 700;
  }

  .run-rows {
    grid-area: rows;
    display: grid;
    gap: var(--space-3);
  }

  .run-row {
    --icon-size: var(--text-xl);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: var(--control-h-lg);
    padding: 0 var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--foreground);
    font: 700 var(--text-xl) / 1 var(--font-sans);
    cursor: pointer;
  }

  .run-row span {
    flex: 1;
    text-align: left;
  }

  .run-row:hover {
    background: var(--surface);
    border-color: var(--line-strong);
  }

  .run-row:focus-visible {
    outline: 3px solid var(--cottontail);
    outline-offset: var(--space-1);
  }

  .run-more {
    grid-area: more;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .run-tools {
    display: flex;
    gap: var(--space-2);
  }

  .run-tools :global(.run-tool) {
    border: 1px solid var(--line);
    border-radius: var(--radius-full);
    background: var(--surface);
  }

  .run :global(.run-resume) {
    grid-area: resume;
    justify-self: end;
  }

  @media (max-height: 500px) {
    .run {
      grid-template: "card card" auto ". ." 1fr "more more" auto "rows resume" auto / 1fr auto;
      gap: var(--space-3);
    }

    .run-card {
      justify-self: start;
      margin: 0;
      padding: var(--space-2) var(--space-4);
    }

    .run-card b {
      font-size: var(--text-2xl);
    }

    .run-rows {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
    }

    .run-row {
      --icon-size: var(--text-2xl);
      flex-direction: column;
      gap: var(--space-2);
      height: auto;
      padding: 0;
      border: 0;
      background: none;
      font-size: var(--text-lg);
    }

    .run-row :global(.ui-icon) {
      box-sizing: content-box;
      padding: var(--space-3);
      border: 1px solid var(--line);
      border-radius: var(--radius-full);
      background: var(--surface);
    }

    .run-row :global(.ui-glyph-cap) {
      display: none;
    }

    .run :global(.run-resume) {
      align-self: end;
    }
  }
</style>
