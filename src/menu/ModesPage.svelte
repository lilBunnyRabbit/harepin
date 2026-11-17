<script lang="ts">
  import type { LevelEntry } from "../modes/modes";
  import { MAX_STARS } from "../modes/track";
  import { aim_or_go, bare_enter } from "./drive-picks";
  import { MODES_PAGE } from "./events-view";
  import MenuFrame from "./MenuFrame.svelte";
  import Card from "./ui/Card.svelte";
  import Chip from "./ui/Chip.svelte";
  import KeyLink from "./ui/KeyLink.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import Row from "./ui/Row.svelte";
  import RowList from "./ui/RowList.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { preview } from "./widgets";
  import "./events.css";

  let { menu, live, shown }: PageProps = $props();

  const host = $derived(menu.host);
  const modes = $derived(live.live(() => host.mode_list()));
  const running = $derived(live.live(() => host.mode_running()));
  const total = $derived(modes.reduce((sum, m) => sum + m.stars, 0));
  const max = $derived(modes.reduce((sum, m) => sum + m.max, 0));

  let picked = $state("");
  let level_id = $state("");
  const mode = $derived(modes.find((m) => m.id === picked) ?? modes[0]);
  const playable = (level: LevelEntry) => level.open && !mode?.blocked && !level.blocked;
  const level = $derived(mode?.levels.find((one) => one.id === level_id) ?? mode?.levels.find((one) => playable(one) && one.stars < MAX_STARS) ?? mode?.levels[0]);
  const can_play = $derived(level !== undefined && playable(level));
  const map = $derived(live.live(() => host.map_name()));

  const minutes = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  function help(one: LevelEntry, i: number): string {
    if (!one.open) return `Finish ${mode?.levels[i - 1]?.name ?? "the level before"} to open it`;
    const route = one.length !== null && one.par_ms !== null ? `${(one.length / 1000).toFixed(1)} km · par ${minutes(one.par_ms)}` : null;
    return [one.blocked, one.brings, route].filter(Boolean).join(" · ");
  }

  function play() {
    if (!level || !can_play) return;
    menu.close();
    host.play_level(level.id);
  }

  function quit() {
    menu.close();
    host.quit_mode();
  }

  function key(event: KeyboardEvent) {
    if (!shown || event.defaultPrevented || !bare_enter(event)) return;
    event.preventDefault();
    play();
  }
</script>

<svelte:window onkeydown={key} />

{#snippet links()}
  {#if running !== null}<KeyLink onclick={quit}>Quit {running}</KeyLink>{/if}
{/snippet}

{#snippet primary()}
  <PrimaryAction disabled={!can_play} onclick={play}>{level ? `Play ${level.name}` : "Play"}</PrimaryAction>
{/snippet}

<MenuFrame {menu} id={MODES_PAGE} eyebrow="Events" title="Free modes" veil={0.55} {links} note={mode?.blocked ?? `Runs on this map, in the car you drive. ★ ${total} of ${max}.`} {primary}>
  {#if mode}
    <div class="modes">
      <div class="modes-list">
      <div class="modes-picks" role="group" aria-label="Modes">
        {#each modes as m (m.id)}
          <Chip variant="toggle" bind:pressed={() => m.id === mode.id, () => ((picked = m.id), (level_id = ""))}>{m.name}<span class="modes-count">{m.stars}/{m.max}</span></Chip>
        {/each}
      </div>
      <Card list class="modes-levels" label={mode.name}>
        <RowList label={`${mode.name} levels`}>
          {#each mode.levels as one, i (one.id)}
            <Row label={one.name} help={help(one, i)} icon={one.open ? undefined : "icon-lock"} fill focused={one === level} onclick={(click) => aim_or_go(click, () => (level_id = one.id), play)} onfocus={() => (level_id = one.id)}>
              {#snippet control()}
                <span class="modes-end">
                  {#if one.best}<span class="modes-best">{one.best}</span>{/if}
                  <span class="ev-stars" aria-label={`${one.stars} of ${MAX_STARS} stars`}>{"★".repeat(one.stars)}<i>{"★".repeat(Math.max(0, MAX_STARS - one.stars))}</i></span>
                </span>
              {/snippet}
            </Row>
          {/each}
        </RowList>
      </Card>
      </div>
      {#if level}
        {#snippet shot()}
          <img class="ev-pic" src={preview(host.kind)} alt="" />
        {/snippet}
        <Card flat picture={shot} class="modes-shot" label={level.name}>
          <span class="ev-eyebrow">{mode.name} · {map}</span>
          <b class="ev-h2">{level.name}</b>
          <span class="ev-small">{help(level, mode.levels.indexOf(level))}</span>
          <span class="modes-end">
            <span class="ev-stars" aria-label={`${level.stars} of ${MAX_STARS} stars`}>{"★".repeat(level.stars)}<i>{"★".repeat(Math.max(0, MAX_STARS - level.stars))}</i></span>
            <span class="modes-best">{level.best ? `Best ${level.best}` : "No time yet"}</span>
          </span>
        </Card>
      {/if}
    </div>
  {/if}
</MenuFrame>

<style>
  .modes {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .modes-list {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--gap);
    min-width: 0;
    min-height: 0;
  }

  .modes-picks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm);
  }

  .modes-count {
    color: var(--dim);
    font-family: var(--font-mono);
    font-weight: 500;
  }

  .modes-list > :global(.modes-levels) {
    align-self: start;
    max-height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .modes-end {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
  }

  .modes-best {
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: var(--type-small);
  }

  /* A phone's list fills the screen by itself, either way up: the picture stays away. */
  @media (max-height: 500px), (max-width: 700px) {
    .modes {
      grid-template-columns: minmax(0, 1fr);
    }

    .modes-list {
      gap: var(--gap-sm);
    }

    .modes > :global(.modes-shot) {
      display: none;
    }

    .modes-picks {
      flex-wrap: nowrap;
      max-width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
  }
</style>
