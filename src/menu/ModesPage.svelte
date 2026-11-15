<script lang="ts">
  import type { LevelEntry } from "../modes/modes";
  import { MAX_STARS } from "../modes/track";
  import Badge from "./ui/Badge.svelte";
  import Button from "./ui/Button.svelte";
  import Icon from "./ui/Icon.svelte";
  import Row from "./ui/Row.svelte";
  import RowList from "./ui/RowList.svelte";
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
  const mode = $derived(modes.find((m) => m.id === picked) ?? modes[0]);

  const minutes = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const meta = (level: LevelEntry, i: number) =>
    [`Level ${i + 1}`, level.length !== null && level.par_ms !== null ? `${(level.length / 1000).toFixed(1)} km · par ${minutes(level.par_ms)}` : ""]
      .filter(Boolean)
      .join(" · ");

  function play(id: string) {
    menu.close();
    host.play_level(id);
  }
</script>

{#if mode}
  <div class="modes">
    <nav class="nav" aria-label="Modes">
      <div class="nav-head"><SectionHead title="Modes" count={`★ ${total} / ${max}`} /></div>
      <div class="nav-tiles">
        {#each modes as m (m.id)}
          <Tile title={m.name} meta={`${m.stars} / ${m.max} ★`} size="sm" variant="nav" selected={m.id === mode.id} onclick={() => (picked = m.id)} />
        {/each}
      </div>
    </nav>

    <div class="main">
      <div class="tabs"><Tabs items={tabs} value={mode.id} label="Modes" compact onchange={(id) => (picked = id)} /></div>
      <div class="head">
        <SectionHead title={mode.name} count={`${mode.stars} / ${mode.max} ★`} level={3}>
          {#snippet action()}
            <span class="total">★ {total} / {max}</span>
            {#if running !== null}
              <Button variant="danger" size="sm" icon="icon-close" onclick={() => (menu.close(), host.quit_mode())}>Quit {running}</Button>
            {/if}
          {/snippet}
        </SectionHead>
        {#if mode.blocked}<p class="blocked">{mode.blocked}</p>{/if}
      </div>

      <ScrollArea class="levels" label={mode.name}>
        <div class="list">
          <RowList divided label={`${mode.name} levels`}>
            {#each mode.levels as level, i (level.id)}
              {@const off = !level.open || mode.blocked !== null || level.blocked !== null}
              <div class="level" class:off>
                <Row label={level.name} help={level.brings} top stack>
                  {#snippet detail()}<span class="meta">{meta(level, i)}</span>{/snippet}
                  {#snippet control()}
                    <span class="end">
                      {#if !level.open}<span class="reason"><Icon name="icon-lock" />Finish {mode.levels[i - 1]?.name}</span>{/if}
                      {#if level.blocked}<span class="reason">{level.blocked}</span>{/if}
                      {#if level.open}
                        {#if level.best}<span class="best">{level.best}</span>{:else}<Badge tone="success">New</Badge>{/if}
                        <span class="star-row" aria-label={`${level.stars} of ${MAX_STARS} stars`}>{"★".repeat(level.stars)}<i>{"★".repeat(Math.max(0, MAX_STARS - level.stars))}</i></span>
                        <Button size="sm" variant={level.stars === 0 && !off ? "primary" : "secondary"} disabled={off} aria-label={`Play ${level.name}`} onclick={() => play(level.id)}>Go</Button>
                      {/if}
                    </span>
                  {/snippet}
                </Row>
              </div>
            {/each}
          </RowList>
        </div>
      </ScrollArea>
    </div>
  </div>
{/if}

<style>
  .modes {
    display: grid;
    grid-template-columns: 16rem minmax(0, 1fr);
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .nav {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
    background: var(--set-well);
  }

  .nav-head {
    padding: var(--space-5) var(--space-5) var(--space-2);
  }

  .nav-tiles {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: 0;
    padding: var(--space-2) var(--space-3) var(--space-4);
    overflow-y: auto;
    scrollbar-width: none;
  }

  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .tabs {
    display: none;
    padding: var(--space-3) var(--space-3) 0;
  }

  .head {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-5) var(--space-6) var(--space-3);
  }

  .total {
    display: none;
    color: var(--set-dim);
    font-size: var(--text-xl);
    font-weight: 600;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .blocked {
    margin: 0;
    color: var(--set-dim);
    text-wrap: pretty;
  }

  .main > :global(.levels) {
    flex: 1;
  }

  .list {
    padding: 0 var(--space-4) var(--space-5);
  }

  .meta {
    font-variant-numeric: tabular-nums;
  }

  .off :global(.ui-text) {
    opacity: 0.55;
  }

  .end {
    --icon-size: var(--text-md);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .reason {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--foreground);
    font-weight: 600;
  }

  .star-row {
    color: var(--accent);
    letter-spacing: 0.15em;
  }

  .star-row i {
    color: var(--line-strong);
    font-style: normal;
  }

  @media (max-height: 500px), (max-width: 900px) {
    .modes {
      grid-template-columns: minmax(0, 1fr);
    }

    .nav {
      display: none;
    }

    .tabs {
      display: flex;
    }

    .total {
      display: block;
    }

    .head {
      padding: var(--space-4) var(--space-5) var(--space-2);
    }

    .list {
      padding: 0 var(--space-2) var(--space-3);
    }
  }

  @media (max-width: 600px) {
    .end {
      justify-content: flex-end;
    }
  }
</style>
