<script lang="ts">
  import type { LevelEntry } from "../modes/modes";
  import { MAX_STARS } from "../modes/track";
  import Badge from "./ui/Badge.svelte";
  import Button from "./ui/Button.svelte";
  import Icon from "./ui/Icon.svelte";
  import ScrollArea from "./ui/ScrollArea.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import Tabs from "./ui/Tabs.svelte";
  import Tile from "./ui/Tile.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  let { menu, live }: PageProps = $props();

  const host = $derived(menu.host);
  const modes = $derived(live.live(() => host.mode_list()));
  const running = $derived(live.live(() => host.mode_running()));
  const total = $derived(modes.reduce((sum, m) => sum + m.stars, 0));
  const max = $derived(modes.reduce((sum, m) => sum + m.max, 0));
  const tabs = $derived(modes.map((m) => ({ id: m.id, label: m.name })));

  let picked = $state("");
  let hovered = $state<{ name: string; text: string } | null>(null);
  const mode = $derived(modes.find((m) => m.id === picked) ?? modes[0]);

  const minutes = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const locked_text = (level: LevelEntry, i: number) =>
    level.blocked ?? (level.open ? "" : `Finish ${mode.levels[i - 1]?.name ?? "the level before"} to open it.`);

  const meta = (level: LevelEntry, i: number) =>
    [`Level ${i + 1}`, level.length !== null && level.par_ms !== null ? `${(level.length / 1000).toFixed(1)} km · par ${minutes(level.par_ms)}` : ""]
      .filter(Boolean)
      .join(" · ");

  const first = $derived(mode?.levels.find((level) => level.open) ?? null);
  const about = $derived(
    hovered ?? (mode.blocked ? { name: mode.name, text: mode.blocked } : { name: first?.name ?? mode.name, text: first?.brings ?? "" }),
  );

  function pick(id: string) {
    picked = id;
    hovered = null;
  }

  function play(id: string) {
    menu.close();
    host.play_level(id);
  }
</script>

{#if mode}
  <div class="modes">
    <div class="top">
      <SectionHead eyebrow="Modes" title={mode.name} count={`${mode.stars} / ${mode.max} ★`}>
        {#snippet action()}
          <span class="total">★ {total} / {max}</span>
        {/snippet}
      </SectionHead>
      <Tabs items={tabs} value={mode.id} label="Modes" onchange={pick} />
    </div>

    <ScrollArea class="levels" label={mode.name}>
      <div class="grid">
        {#each mode.levels as level, i (level.id)}
          {@const locked = locked_text(level, i)}
          <div
            class="level"
            role="presentation"
            onpointerenter={() => (hovered = { name: level.name, text: locked || level.brings })}
            onfocusin={() => (hovered = { name: level.name, text: locked || level.brings })}
          >
            <Tile title={level.name} meta={meta(level, i)} disabled={!level.open || mode.blocked !== null || level.blocked !== null} onclick={() => play(level.id)}>
              <span class="foot">
                {#if level.open}
                  <span class="star-row" aria-label={`${level.stars} of ${MAX_STARS} stars`}>{"★".repeat(level.stars)}<i>{"★".repeat(Math.max(0, MAX_STARS - level.stars))}</i></span>
                  {#if level.best}<small>{level.best}</small>{:else}<Badge tone="success">New</Badge>{/if}
                {:else}
                  <span class="lock"><Icon name="icon-lock" />Finish {mode.levels[i - 1]?.name}</span>
                {/if}
              </span>
            </Tile>
          </div>
        {/each}
      </div>
      {#if mode.blocked}<p class="blocked">{mode.blocked}</p>{/if}
    </ScrollArea>

    <div class="bar">
      <p class="about"><b>{about.name}</b>{about.text}</p>
      {#if running !== null}
        <Button variant="danger" icon="icon-close" onclick={() => (menu.close(), host.quit_mode())}>Quit {running}</Button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modes {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: var(--space-5);
    height: 100%;
    min-height: 0;
  }

  .top {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }

  .total {
    color: var(--set-dim);
    font-size: var(--text-md);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: var(--space-3);
  }

  .level {
    display: grid;
    min-width: 0;
  }

  .foot {
    --icon-size: var(--text-md);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-top: var(--space-1);
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }

  .star-row {
    color: var(--accent);
    letter-spacing: 0.15em;
  }

  .star-row i {
    color: var(--line-strong);
    font-style: normal;
  }

  .lock {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .blocked {
    margin: var(--space-4) 0 0;
    color: var(--set-dim);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-height: var(--control-h-lg);
    padding-top: var(--space-4);
    border-top: 1px solid var(--set-line);
  }

  .about {
    flex: 1;
    min-width: 0;
    margin: 0;
    color: var(--set-dim);
    text-wrap: pretty;
  }

  .about b {
    margin-right: var(--space-2);
    color: var(--foreground);
  }

  :global(.settings[data-view="page"] .settings-page[data-section="modes"]) {
    max-width: none;
    height: 100%;
    padding: 0;
    border: 0;
    background: none;
    overflow: visible;
  }

  @media (max-width: 600px) {
    .bar {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
