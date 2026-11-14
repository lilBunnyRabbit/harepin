<script lang="ts">
  import { untrack } from "svelte";
  import { current_theme } from "../../theme/theme";
  import Button from "../ui/Button.svelte";
  import Kbd from "../ui/Kbd.svelte";
  import ScrollArea from "../ui/ScrollArea.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import Tile from "../ui/Tile.svelte";
  import AudioSection from "./AudioSection.svelte";
  import Bindings from "./Bindings.svelte";
  import CameraSection from "./CameraSection.svelte";
  import ChangesList from "./ChangesList.svelte";
  import ControlsSection from "./ControlsSection.svelte";
  import DisplaySection from "./DisplaySection.svelte";
  import DrivingSection from "./DrivingSection.svelte";
  import GraphicsSection from "./GraphicsSection.svelte";
  import KeyList from "./KeyList.svelte";
  import { provide_nav, type SettingsNav } from "./nav.svelte";
  import OnlineSection from "./OnlineSection.svelte";
  import SavedThemes from "./SavedThemes.svelte";
  import { CHANGES, DEEP, SECTIONS, summary } from "./sections";
  import ThemeCreate from "./ThemeCreate.svelte";

  interface Props extends PageProps {
    nav: SettingsNav;
    open_guide: () => void;
  }

  let { menu, live, shown, nav, open_guide }: Props = $props();

  provide_nav(untrack(() => nav));

  const LEGEND: [string[], string][] = [
    [["A"], "Select"],
    [["B"], "Back"],
    [["Y"], "Reset section"],
    [["LT", "RT"], "Section"],
    [["LB", "RB"], "Tab"],
  ];

  const tier = $derived(live.live(() => menu.host.quality_status().tier));
  const theme = $derived(live.live(current_theme));
  const parent = $derived(nav.parent());
  const resettable = $derived(nav.keys().length > 0);
  const help = $derived(nav.help);

  $effect(() => {
    if (shown) untrack(() => nav.show(nav.sub, false));
  });
</script>

<div class="set">
  <nav class="set-nav" aria-label="Settings sections">
    <div class="set-tiles">
      {#each SECTIONS as section (section.id)}
        <Tile
          title={section.label}
          meta={summary(section.id, live.prefs, tier, theme)}
          icon={section.icon}
          size="sm"
          variant="nav"
          selected={nav.top() === section.id}
          onclick={() => nav.show(section.id)}
        />
      {/each}
    </div>
    <div class="set-foot">
      <Button variant="quiet" size="sm" class="set-pill" title="What's new" aria-label={`What's new in v${menu.host.version}`} aria-current={nav.sub === CHANGES} onclick={() => nav.show(CHANGES)}>
        <span class="set-dot"></span>v{menu.host.version}
      </Button>
      <Button variant="quiet" size="sm" class="set-guide" title="The first-run guide, with your current choices" onclick={open_guide}>Guide</Button>
    </div>
  </nav>

  <div class="set-main">
    <div class="set-head">
      {#if parent}
        <Button variant="quiet" size="sm" icon="icon-back" onclick={() => nav.show(parent)}>{nav.label(parent)}</Button>
      {/if}
      <div class="set-title"><SectionHead title={nav.label(nav.sub)} level={3} /></div>
      {#if resettable}
        <Button variant="quiet" size="sm" icon="icon-restart" aria-label="Reset section" onclick={() => nav.reset()}>
          <span class="set-reset-long">Reset section</span><span class="set-reset-short">Reset</span>
        </Button>
      {/if}
    </div>
    <ScrollArea class="set-scroll">
      <section class="set-list" aria-label="Graphics" hidden={nav.sub !== "graphics"} bind:this={nav.lists.graphics}><GraphicsSection {menu} {live} /></section>
      <section class="set-list" aria-label="Display" hidden={nav.sub !== "display"} bind:this={nav.lists.display}><DisplaySection {live} /></section>
      <section class="set-list" aria-label="Driving" hidden={nav.sub !== "driving"} bind:this={nav.lists.driving}><DrivingSection {live} /></section>
      <section class="set-list" aria-label="Camera" hidden={nav.sub !== "camera"} bind:this={nav.lists.camera}><CameraSection {live} /></section>
      <section class="set-list" aria-label="Controls" hidden={nav.sub !== "controls"} bind:this={nav.lists.controls}><ControlsSection {live} /></section>
      <section class="set-list" aria-label="Audio" hidden={nav.sub !== "audio"} bind:this={nav.lists.audio}><AudioSection {live} /></section>
      <section class="set-list" aria-label="Online" hidden={nav.sub !== "net"} bind:this={nav.lists.net}><OnlineSection {menu} {live} /></section>
      <section class="set-list" aria-label={DEEP[0].label} hidden={nav.sub !== "creator"} bind:this={nav.lists.creator}><ThemeCreate /></section>
      <section class="set-list" aria-label={DEEP[1].label} hidden={nav.sub !== "themes"} bind:this={nav.lists.themes}><SavedThemes /></section>
      <section class="set-list" aria-label={DEEP[2].label} hidden={nav.sub !== "keys"} bind:this={nav.lists.keys}><KeyList {live} /></section>
      <section class="set-list" aria-label={DEEP[3].label} hidden={nav.sub !== "bindings"} bind:this={nav.lists.bindings}><Bindings {menu} {live} /></section>
      <section class="set-list" aria-label="What's new" hidden={nav.sub !== CHANGES} bind:this={nav.lists[CHANGES]}><ChangesList {menu} /></section>
    </ScrollArea>
  </div>

  <aside class="set-help" aria-live="polite">
    <ScrollArea class="set-help-scroll">
      {#if help}
        <div class="set-help-body">
          <SectionHead title={help.title} level={4} />
          <p class="set-help-text">{help.text()}</p>
          {#if help.visual}<div class="set-help-visual">{@render help.visual()}</div>{/if}
        </div>
      {/if}
    </ScrollArea>
  </aside>

  <div class="set-legend">
    {#each LEGEND as [glyphs, text] (text)}
      <span class="set-hint"><Kbd keys={glyphs} />{text}</span>
    {/each}
  </div>
</div>

<style>
  .set {
    display: grid;
    grid-template: "nav main help" minmax(0, 1fr) "legend legend legend" auto / 16rem minmax(0, 1fr) 20rem;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  .set-nav {
    grid-area: nav;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: 0;
    overflow: hidden;
    background: var(--set-well);
  }

  .set-tiles {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: 0;
    padding: var(--space-4) var(--space-3);
    overflow-y: auto;
    scrollbar-width: none;
  }

  .set-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
    border-top: 1px solid var(--set-line);
  }

  .set-foot :global(.set-pill) {
    border-color: var(--line-strong);
    border-radius: var(--radius-full);
    background: var(--set-raised);
    color: var(--foreground);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1;
  }

  .set-foot :global(.set-pill:hover:not(:disabled)) {
    border-color: var(--primary);
  }

  .set-foot :global(.set-pill[aria-current="true"]) {
    border-color: var(--primary);
  }

  .set-dot {
    flex: none;
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--primary);
  }

  .set-foot :global(.set-guide) {
    color: var(--foreground);
  }

  .set-foot :global(.set-guide:hover:not(:disabled)) {
    background: var(--set-raised);
  }

  .set-main {
    grid-area: main;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .set-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--control-h-lg);
    padding: var(--space-4) var(--space-5) var(--space-2);
  }

  .set-title {
    flex: 1;
    min-width: 0;
  }

  .set-reset-short {
    display: none;
  }

  .set-main > :global(.set-scroll) {
    flex: 1;
  }

  .set-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-4) var(--space-5);
  }

  .set-list[hidden] {
    display: none;
  }

  .set-list > :global(*) {
    flex: none;
  }

  .set-help {
    grid-area: help;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid var(--set-line);
  }

  .set-help-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-6);
  }

  .set-help-text {
    margin: 0;
    max-width: 65ch;
    color: var(--set-dim);
    font-size: var(--text-lg);
    line-height: 1.5;
    text-wrap: pretty;
  }

  .set-help-visual {
    margin-top: var(--space-2);
  }

  .set-legend {
    grid-area: legend;
    display: none;
    justify-content: flex-end;
    gap: var(--space-6);
    padding: var(--space-3) var(--space-6);
    border-top: 1px solid var(--set-line);
    color: var(--set-dim);
    font-size: var(--text-md);
  }

  :global(.settings[data-pad]) .set-legend {
    display: flex;
  }

  .set-hint {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  @media (max-width: 1100px) {
    .set {
      grid-template: "nav main" minmax(0, 1fr) "nav help" auto "legend legend" auto / 14rem minmax(0, 1fr);
    }

    .set-help {
      border-top: 1px solid var(--set-line);
      border-left: 0;
    }

    .set-help > :global(.set-help-scroll) {
      max-height: 9rem;
    }

    .set-help-body {
      gap: var(--space-1);
      padding: var(--space-3) var(--space-5);
    }

    .set-help-text {
      font-size: var(--text-md);
      line-height: 1.45;
    }

    .set-help-visual {
      display: none;
    }
  }

  @media (max-height: 500px), (max-width: 600px) {
    .set {
      grid-template: "nav main" minmax(0, 1fr) "nav help" auto / 5rem minmax(0, 1fr);
    }

    .set-nav {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-2) var(--space-1);
      overflow-y: auto;
      scrollbar-width: none;
    }

    .set-tiles {
      display: contents;
    }

    .set-dot,
    .set-legend {
      display: none;
    }

    .set-foot {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-1);
      margin-top: var(--space-1);
      padding: var(--space-2) 0 0;
    }

    .set-foot :global(.ui-button) {
      height: auto;
      min-height: var(--control-h-sm);
      padding: var(--space-1) 0;
      font-size: var(--text-xs);
    }

    .set-head {
      min-height: 0;
      padding: var(--space-3) var(--space-4) var(--space-1);
    }

    .set-list {
      padding: 0 var(--space-2) var(--space-3);
    }

    .set-help > :global(.set-help-scroll) {
      max-height: none;
    }

    .set-help-body {
      padding: var(--space-2) var(--space-4) var(--space-3);
    }

    .set-reset-long {
      display: none;
    }

    .set-reset-short {
      display: inline;
    }
  }

  @media (max-height: 500px) {
    .set-help > :global(.set-help-scroll) {
      max-height: 3rem;
    }
  }
</style>
