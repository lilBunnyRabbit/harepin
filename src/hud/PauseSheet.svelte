<script lang="ts">
  import Glyph from "../menu/ui/Glyph.svelte";
  import Icon from "../menu/ui/Icon.svelte";
  import IconButton from "../menu/ui/IconButton.svelte";
  import KeyButton from "../menu/ui/KeyButton.svelte";
  import PauseAids from "./PauseAids.svelte";
  import { ROWS, with_cap, type PauseKeys } from "./pause-keys";
  import type { PauseAct, PauseAid, PauseAids as Aids, PauseCard } from "./pause-view.svelte";

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
</script>

<div class="run">
  <section class="run-panel" aria-label={card.kind === "roam" ? "Free roam" : "This run"}>
    <header class="run-head">
      <span class="run-eyebrow" data-live={solo ? undefined : ""}>{solo ? "Paused" : "Menu"} · {card.context}</span>
      <b>{card.title}</b>
      {#if card.facts.length}
        <span class="run-facts">
          {#each card.facts as fact, index (index)}<span>{fact}</span>{/each}
        </span>
      {/if}
    </header>

    <nav class="run-rows" aria-label="Pause" style:--cols={Math.ceil(ROWS[card.kind].length / 2)}>
      {#each ROWS[card.kind] as row (row.act)}
        <button type="button" class="run-row" onclick={() => onact(row.act)}>
          <span class="run-well"><Icon name={row.icon} /></span>
          <span class="run-label">{row.label}</span>
          <Glyph key={caps[row.act]} />
        </button>
      {/each}
    </nav>

    <footer class="run-aids">
      <PauseAids {aids} {onflip} />
    </footer>
  </section>

  <div class="run-end">
    <IconButton class="run-tool" shape="round" icon="icon-camera" label="Camera" title={with_cap("Camera", caps.camera)} onclick={() => onact("camera")} />
    <IconButton class="run-tool" shape="round" icon="icon-chat" label="Chat" title={with_cap("Chat", caps.chat)} onclick={() => onact("chat")} />
    <!-- svelte-ignore a11y_autofocus -->
    <KeyButton class="run-resume" size="lg" keys={{ key: "Esc", pad: "B", touch: "icon-play" }} onclick={onresume} autofocus>Resume</KeyButton>
  </div>
</div>

<style>
  .run {
    display: grid;
    grid-template: "panel ." auto ". ." 1fr ". end" auto / minmax(0, 28rem) 1fr;
    height: 100%;
  }

  .run-panel {
    grid-area: panel;
    display: grid;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--panel-shadow);
    overflow: hidden;
  }

  .run-head {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-5) var(--space-6);
  }

  .run-head b {
    font-size: var(--text-3xl);
    font-weight: 800;
    line-height: 1.1;
  }

  .run-eyebrow {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .run-eyebrow::before {
    content: "";
    width: var(--space-2);
    height: var(--space-2);
    border-radius: 50%;
    background: var(--line-strong);
  }

  .run-eyebrow[data-live]::before {
    background: var(--success);
  }

  .run-facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .run-facts span {
    display: inline-flex;
    align-items: center;
    height: var(--space-6);
    padding: 0 var(--space-3);
    border-radius: var(--radius-full);
    background: color-mix(in oklch, var(--foreground) 8%, transparent);
    color: var(--dim);
    font: 600 var(--text-sm) / 1 var(--font-mono);
    white-space: nowrap;
  }

  .run-facts span:first-child {
    color: var(--foreground);
    font-weight: 700;
  }

  .run-rows {
    display: grid;
    border-top: 1px solid var(--line);
  }

  .run-row {
    --icon-size: var(--text-xl);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: var(--control-h-lg);
    padding: 0 var(--space-5) 0 var(--space-4);
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--foreground);
    font: 700 var(--text-xl) / 1 var(--font-sans);
    cursor: pointer;
  }

  .run-row + .run-row {
    border-top: 1px solid var(--line);
  }

  .run-row:hover {
    background: color-mix(in oklch, var(--foreground) 6%, transparent);
  }

  .run-row:focus-visible {
    outline: 3px solid var(--cottontail);
    outline-offset: calc(-1 * var(--space-1));
    border-radius: var(--radius-md);
  }

  .run-well {
    display: grid;
    place-items: center;
    width: var(--space-8);
    height: var(--space-8);
    border-radius: 50%;
    background: color-mix(in oklch, var(--foreground) 8%, transparent);
  }

  .run-well :global(.ui-icon) {
    fill: currentColor;
  }

  .run-label {
    flex: 1;
    text-align: left;
  }

  .run-row :global(.ui-glyph-cap) {
    min-width: var(--space-6);
    font-size: var(--text-sm);
  }

  .run-aids {
    padding: var(--space-4) var(--space-6) var(--space-5);
    border-top: 1px solid var(--line);
    background: color-mix(in oklch, var(--foreground) 4%, transparent);
  }

  .run-end {
    grid-area: end;
    justify-self: end;
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .run-end :global(.run-tool) {
    width: var(--control-h-lg);
    height: var(--control-h-lg);
  }

  @media (max-height: 500px) {
    .run {
      grid-template: "panel ." 1fr "panel end" auto / auto 1fr;
    }

    .run-panel {
      align-self: start;
      width: 27rem;
    }

    .run-head {
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4);
    }

    .run-head b {
      font-size: var(--text-2xl);
    }

    .run-facts {
      flex-wrap: nowrap;
      overflow: hidden;
      margin: 0;
    }

    .run-facts span:nth-child(n + 3) {
      display: none;
    }

    .run-rows {
      grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
      row-gap: var(--space-1);
      padding: var(--space-2);
    }

    .run-row {
      --icon-size: var(--text-2xl);
      flex-direction: column;
      gap: var(--space-1);
      height: auto;
      padding: var(--space-2) var(--space-1);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
    }

    .run-row + .run-row {
      border-top: 0;
    }

    .run-well {
      width: calc(var(--space-8) + var(--space-1));
      height: calc(var(--space-8) + var(--space-1));
    }

    .run-label {
      flex: none;
      text-align: center;
      white-space: nowrap;
    }

    .run-row :global(.ui-glyph) {
      display: none;
    }

    .run-aids {
      padding: var(--space-3) var(--space-4);
    }
  }
</style>
