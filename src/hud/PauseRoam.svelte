<script lang="ts">
  import CarStill from "../menu/CarStill.svelte";
  import Glyph from "../menu/ui/Glyph.svelte";
  import Icon from "../menu/ui/Icon.svelte";
  import IconButton from "../menu/ui/IconButton.svelte";
  import KeyButton from "../menu/ui/KeyButton.svelte";
  import { preview } from "../menu/widgets";
  import PauseAids from "./PauseAids.svelte";
  import { with_cap, type PauseKeys } from "./pause-keys";
  import type { PauseAct, PauseAid, PauseAids as Aids, RoamCard } from "./pause-view.svelte";

  interface Props {
    card: RoamCard;
    aids: Aids;
    solo: boolean;
    caps: PauseKeys["caps"];
    onact: (act: PauseAct) => void;
    onflip: (aid: PauseAid) => void;
    onresume: () => void;
  }

  let { card, aids, solo, caps, onact, onflip, onresume }: Props = $props();

  interface Door {
    act: PauseAct;
    label: string;
    icon: string;
    note: string;
    badge: string | null;
    art: string | null;
  }

  const doors: Door[] = $derived([
    { act: "map", label: "Map", icon: "icon-globe", note: "this map", badge: `${card.flags} ${card.flags === 1 ? "flag" : "flags"} here`, art: preview(`${card.world}-map`) },
    { act: "events", label: "Events", icon: "icon-modes", note: "all maps", badge: card.tier, art: preview(card.next_world ?? card.world) },
    { act: "garage", label: "Garage", icon: "icon-car", note: "", badge: null, art: null },
    { act: "online", label: "Online", icon: "icon-people", note: `${card.players} here`, badge: null, art: preview(card.world) },
  ]);

  const missing = (event: Event) => ((event.currentTarget as HTMLElement).hidden = true);
</script>

<div class="roam">
  <header class="roam-top">
    <PauseAids {aids} {onflip} />
    <p class="roam-hint">Each door opens the <b>showroom</b> at that station</p>
  </header>

  <div class="roam-bar">
    <button type="button" class="roam-place" onclick={() => onact("showroom")}>
      <span class="roam-eyebrow">{solo ? "Paused" : "Menu"} · free roam</span>
      <b>{card.map}</b>
      {#if card.next}<span class="roam-next">Next up: {card.next}</span>{/if}
    </button>
    <!-- svelte-ignore a11y_autofocus -->
    <KeyButton class="roam-resume" size="lg" keys={{ key: "Esc", pad: "B", touch: "icon-play" }} onclick={onresume} autofocus>Resume</KeyButton>
    <div class="roam-tools">
      <IconButton class="roam-tool" icon="icon-reset-car" label="Reset car" title={with_cap("Reset car", caps.reset)} onclick={() => onact("reset")} />
      <IconButton class="roam-tool" icon="icon-camera" label="Camera" title={with_cap("Camera", caps.camera)} onclick={() => onact("camera")} />
      <IconButton class="roam-tool" icon="icon-chat" label="Chat" title={with_cap("Chat", caps.chat)} onclick={() => onact("chat")} />
      <IconButton class="roam-tool" icon="icon-settings" label="Settings" title={with_cap("Settings", caps.settings)} onclick={() => onact("settings")} />
    </div>
  </div>

  <nav class="roam-doors" aria-label="Showroom stations">
    {#each doors as door (door.act)}
      <button type="button" class="roam-door" onclick={() => onact(door.act)}>
        <span class="roam-art">
          {#if door.act === "garage"}
            <CarStill car={card.car} />
          {:else if door.art}
            <img src={door.art} alt="" onerror={missing} />
          {/if}
          {#if door.badge}<span class="roam-badge">{door.badge}</span>{/if}
        </span>
        <span class="roam-label">
          <Glyph key={caps[door.act]} />
          <Icon name={door.icon} />
          <b>{door.label}</b>
          {#if door.note}<span>{door.note}</span>{/if}
        </span>
      </button>
    {/each}
  </nav>

  <footer class="roam-keys" aria-hidden="true">
    <span><Glyph key="← →" pad="✥" />Choose</span>
    <span><Glyph key="Enter" pad="A" />Open</span>
    {#if caps.reset}<span><Glyph key={caps.reset} />Reset car</span>{/if}
    <span><Glyph key="Esc" pad="B" />Resume</span>
  </footer>
</div>

<style>
  .roam {
    display: grid;
    grid-template-rows: auto 1fr auto auto auto;
    gap: var(--space-4);
    height: 100%;
  }

  .roam-top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .roam-top > :global(.pause-aids),
  .roam-hint {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-full);
    background: var(--surface);
  }

  .roam-hint {
    margin: 0;
    padding-block: var(--space-3);
    color: var(--dim);
    font-size: var(--text-lg);
  }

  .roam-hint b {
    color: var(--foreground);
  }

  .roam-bar {
    grid-row: 3;
    display: flex;
    align-items: stretch;
    gap: var(--space-3);
  }

  .roam-place {
    display: grid;
    justify-content: start;
    flex: 0 1 auto;
    align-content: center;
    gap: var(--space-1);
    min-width: 0;
    height: auto;
    padding: var(--space-3) var(--space-5);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--foreground);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .roam-place b {
    overflow: hidden;
    font-size: var(--text-2xl);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .roam-eyebrow {
    color: var(--dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .roam-next {
    overflow: hidden;
    color: var(--dim);
    font-size: var(--text-lg);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .roam-bar :global(.roam-resume) {
    flex: 1 1 0;
    height: auto;
    min-height: calc(var(--control-h-lg) + var(--space-3));
  }

  .roam-tools {
    display: flex;
    gap: var(--space-2);
  }

  .roam-tools :global(.roam-tool) {
    --icon-size: var(--text-2xl);
    width: auto;
    height: auto;
    aspect-ratio: 1;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .roam-doors {
    grid-row: 4;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .roam-door {
    display: grid;
    grid-template-rows: 1fr auto;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    justify-content: stretch;
    min-width: 0;
    height: auto;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--foreground);
    font: inherit;
    cursor: pointer;
  }

  .roam-place:hover,
  .roam-door:hover {
    background: var(--surface);
    border-color: var(--line-strong);
  }

  .roam-door:focus-visible,
  .roam-place:focus-visible {
    outline: 3px solid var(--cottontail);
    outline-offset: var(--space-1);
  }

  .roam-art {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--panel-well);
  }

  .roam-art img,
  .roam-art :global(.still) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .roam-art :global(.still img) {
    object-fit: contain;
  }

  .roam-badge {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    background: var(--surface);
    font: 700 var(--text-md) / 1.2 var(--font-mono);
  }

  .roam-label {
    --icon-size: var(--text-2xl);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--line);
  }

  .roam-label b {
    font-size: var(--text-2xl);
  }

  .roam-label span {
    margin-left: auto;
    color: var(--dim);
    font-size: var(--text-lg);
  }

  .roam-keys {
    grid-row: 5;
    display: flex;
    flex-wrap: wrap;
    justify-self: center;
    gap: var(--space-2) var(--space-5);
    padding: var(--space-2) var(--space-5);
    border: 1px solid var(--line);
    border-radius: var(--radius-full);
    background: var(--surface);
    font-size: var(--text-lg);
  }

  .roam-keys span {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  :global(:root[data-input="touch"]) .roam-keys {
    display: none;
  }

  @media (max-height: 500px) {
    .roam {
      grid-template-rows: auto auto 1fr;
      gap: var(--space-3);
    }

    .roam-top {
      grid-row: 1;
    }

    .roam-hint,
    .roam-keys,
    .roam-eyebrow + b + .roam-next {
      display: none;
    }

    .roam-bar {
      grid-row: 2;
    }

    .roam-doors {
      grid-row: 3;
      gap: var(--space-3);
      min-height: 0;
    }

    .roam-art {
      aspect-ratio: auto;
      min-height: 0;
    }

    .roam-door {
      grid-template-rows: minmax(0, 1fr) auto;
      min-height: 0;
    }

    .roam-label {
      padding: var(--space-2) var(--space-3);
    }

    .roam-label b {
      font-size: var(--text-xl);
    }

    .roam-place b {
      font-size: var(--text-xl);
    }
  }

  @media (max-width: 600px) {
    .roam-doors {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .roam-bar {
      flex-wrap: wrap;
    }

    .roam-place {
      flex-basis: 100%;
    }
  }
</style>
