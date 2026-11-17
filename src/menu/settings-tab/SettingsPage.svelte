<script lang="ts">
  import { untrack } from "svelte";
  import { CHANGELOG } from "../../changelog";
  import { GOALS } from "../../goals/goals";
  import { current_theme } from "../../theme/theme";
  import { UpdateState } from "../../version";
  import { bare_enter, link_key } from "../drive-picks";
  import { GUIDE_PAGE, TOPICS } from "../guide-topics";
  import FrameChips from "../FrameChips.svelte";
  import MenuFrame from "../MenuFrame.svelte";
  import { MenuTab, ROAD } from "../page";
  import Card from "../ui/Card.svelte";
  import Icon from "../ui/Icon.svelte";
  import KeyLink from "../ui/KeyLink.svelte";
  import PageFrame from "../ui/PageFrame.svelte";
  import PrimaryAction from "../ui/PrimaryAction.svelte";
  import ScrollArea from "../ui/ScrollArea.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import AudioSection from "./AudioSection.svelte";
  import Bindings from "./Bindings.svelte";
  import CameraSection from "./CameraSection.svelte";
  import ControlsSection from "./ControlsSection.svelte";
  import DisplaySection from "./DisplaySection.svelte";
  import DrivingSection from "./DrivingSection.svelte";
  import GraphicsSection from "./GraphicsSection.svelte";
  import KeyList from "./KeyList.svelte";
  import { provide_nav, type SettingsNav } from "./nav.svelte";
  import OnlineSection from "./OnlineSection.svelte";
  import SavedThemes from "./SavedThemes.svelte";
  import { CHANGES, DEEP, LIST, SECTIONS, summary } from "./sections";
  import ThemeCreate from "./ThemeCreate.svelte";

  const STATION = "Settings";
  const ARM_MS = 3000;

  interface Props extends PageProps {
    nav: SettingsNav;
  }

  let { menu, live, shown, nav }: Props = $props();

  provide_nav(untrack(() => nav));

  const host = $derived(menu.host);
  const summary_live = $derived({ tier: live.live(() => host.quality_status().tier), theme: live.live(current_theme), name: live.live(() => host.name()) });
  const goals_done = $derived(live.live(() => host.goals.count));
  const update_ready = $derived(live.live(() => host.update_state()) === UpdateState.READY);
  const latest = $derived(CHANGELOG.find((release) => release.version === host.version) ?? CHANGELOG[0]);

  const doors = $derived([
    ...SECTIONS.map((section) => ({ id: section.id, label: section.label, icon: section.icon, values: summary(section.id, live.prefs, summary_live), open: () => nav.show(section.id) })),
    { id: GUIDE_PAGE, label: "Guide", icon: "icon-book", values: [`${TOPICS.length} topics`, `${goals_done} of ${GOALS.length} first steps`], open: () => menu.show(GUIDE_PAGE) },
    {
      id: CHANGES,
      label: "What's new",
      icon: "icon-spark",
      values: [...(update_ready ? ["Update ready"] : []), `v${host.version}`, `${latest.changes.length} ${latest.changes.length === 1 ? "change" : "changes"}`],
      open: () => menu.show(CHANGES),
    },
    { id: MenuTab.SUPPORT, label: "Support", icon: "icon-heart", values: ["Feedback", "Chip in"], open: () => menu.show(MenuTab.SUPPORT) },
  ]);

  let picked = $state(SECTIONS[0].id);
  const door = $derived(doors.find((one) => one.id === picked) ?? doors[0]);
  let armed = $state(false);

  const on_list = $derived(nav.sub === LIST);
  const parent = $derived(nav.parent());
  const opener = $derived(live.live(() => menu.up_of(MenuTab.SETTINGS)));
  const up = $derived(parent ? nav.label(parent) : opener === ROAD ? STATION : opener);
  const resettable = $derived(nav.keys().length > 0);
  const help = $derived(nav.help);

  export function back(): boolean {
    if (on_list) return false;
    if (parent) nav.show(parent);
    else nav.close();
    return true;
  }

  $effect(() => {
    if (!shown) return;
    untrack(() => nav.sub !== LIST && nav.show(nav.sub, false));
    return () => {
      nav.close();
      armed = false;
    };
  });

  $effect(() => {
    if (!armed) return;
    const timer = setTimeout(() => (armed = false), ARM_MS);
    return () => clearTimeout(timer);
  });

  function reset_all() {
    if (!armed) return void (armed = true);
    armed = false;
    for (const section of SECTIONS) for (const key of section.keys) nav.reset_key(key);
  }

  function key(event: KeyboardEvent) {
    if (!shown || event.defaultPrevented) return;
    if (link_key(event) === "x") return on_list ? reset_all() : nav.reset();
    if (!on_list || !bare_enter(event)) return;
    event.preventDefault();
    door.open();
  }
</script>

<svelte:window onkeydown={key} />

{#snippet list_links()}
  <KeyLink keys={{ key: "X" }} onclick={reset_all}>{armed ? "Press again to reset every setting" : "Reset all"}</KeyLink>
{/snippet}

{#snippet list_primary()}
  <PrimaryAction onclick={() => door.open()}>Open {door.label}</PrimaryAction>
{/snippet}

{#snippet section_chips()}
  <FrameChips {menu} season={false} />
{/snippet}

{#snippet section_links()}
  {#if resettable}<KeyLink keys={{ key: "X", pad: "Y" }} onclick={() => nav.reset()}>Reset {nav.label(nav.sub)}</KeyLink>{/if}
{/snippet}

{#if on_list}
  <MenuFrame {menu} id={MenuTab.SETTINGS} season={false} veil={0.6} links={list_links} primary={list_primary}>
    <div class="set-doors">
      {#each doors as one (one.id)}
        <Card flat pad="none" class="set-door" focused={one.id === picked} onclick={() => ((picked = one.id), one.open())} onfocus={() => (picked = one.id)} label={one.label}>
          <span class="set-door-row">
            <span class="set-door-icon"><Icon name={one.icon} /></span>
            <b class="set-door-name">{one.label}</b>
            <span class="set-door-values">
              {#each one.values as value, at (at)}{#if at > 0}<i>·</i>{/if}<span>{value}</span>{/each}
            </span>
            <span class="set-door-go"><Icon name="icon-back" flip /></span>
          </span>
        </Card>
      {/each}
    </div>
  </MenuFrame>
{/if}
<div class="set-step" hidden={on_list}>
  <PageFrame eyebrow={parent ? nav.label(parent) : STATION} title={nav.label(nav.sub)} chips={section_chips} back={{ to: up, go: () => menu.back() }} links={section_links} veil={0.6}>
    <div class="set-page">
      <Card list class="set-rows" label={nav.label(nav.sub)}>
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
        </ScrollArea>
      </Card>
      <Card class="set-help" label="About this setting">
        <div class="set-help-body" aria-live="polite">
          {#if help}
            <span class="set-help-head">
              <span class="set-eyebrow">{nav.label(nav.sub)}</span>
              <b class="set-help-title">{help.title}</b>
            </span>
            <p class="set-help-text">{help.text()}</p>
            {#if help.visual}<div class="set-help-visual">{@render help.visual()}</div>{/if}
          {/if}
        </div>
      </Card>
    </div>
  </PageFrame>
</div>

<style>
  .set-doors {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(5, minmax(0, 6rem));
    grid-auto-flow: column;
    align-content: center;
    gap: var(--gap-md) var(--gap);
    height: 100%;
    min-height: 0;
  }

  .set-doors > :global(.set-door) {
    justify-content: center;
  }

  .set-door-row {
    display: grid;
    grid-template-columns: auto 7.5em minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--gap);
    padding: 0 var(--pad);
  }

  .set-door-icon,
  .set-door-go {
    display: grid;
    flex: none;
    color: var(--dim);
  }

  .set-door-icon {
    --icon-size: 1.7em;
  }

  .set-door-go {
    --icon-size: 1.15em;
  }

  .set-doors > :global([data-focused] .set-door-icon) {
    color: var(--cottontail);
  }

  .set-door-name {
    font-size: var(--type-h3);
    font-weight: 700;
    white-space: nowrap;
  }

  .set-door-values {
    display: flex;
    gap: 0.5em;
    min-width: 0;
    overflow: hidden;
    color: var(--dim);
    font-size: var(--type-small);
    white-space: nowrap;
  }

  .set-door-values > span {
    flex: none;
  }

  .set-door-values > span:last-child {
    flex: 0 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .set-door-values > i {
    flex: none;
    color: var(--line-strong);
    font-style: normal;
  }

  .set-step[hidden] {
    display: none;
  }

  .set-page {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 330px;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .set-page > :global(.set-rows) {
    align-self: start;
    max-height: 100%;
  }

  .set-page > :global(.set-rows > .set-scroll) {
    min-height: 0;
  }

  .set-list {
    display: flex;
    flex-direction: column;
  }

  .set-list[hidden] {
    display: none;
  }

  .set-list > :global(*) {
    flex: none;
  }

  .set-list > :global(* + *) {
    border-top: 1px solid var(--line);
  }

  .set-page > :global(.set-help) {
    align-self: start;
    max-height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .set-help-body {
    display: grid;
    gap: var(--gap-md);
    min-height: calc(var(--type-h3) * 3);
  }

  .set-help-head {
    display: grid;
    gap: var(--gap-xs);
  }

  .set-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .set-help-title {
    font-size: var(--type-h3);
    font-weight: 700;
    line-height: 1.15;
  }

  .set-help-text {
    margin: 0;
    color: var(--dim);
    font-size: var(--type-small);
    line-height: 1.45;
    text-wrap: pretty;
  }

  @media (max-height: 500px) {
    .set-doors {
      grid-template-rows: repeat(5, minmax(var(--primary-h), 1fr));
      height: auto;
      min-height: 100%;
      padding: calc(var(--mark-w) + var(--space-0));
    }

    .set-door-row {
      grid-template-columns: auto 6.5em minmax(0, 1fr) auto;
      gap: var(--gap-md);
    }

    .set-door-icon {
      --icon-size: 1.5em;
    }

    .set-page {
      grid-template-columns: minmax(0, 1fr) 230px;
      height: auto;
      align-items: start;
    }

    .set-page > :global(.set-rows),
    .set-page > :global(.set-help) {
      max-height: none;
    }

    .set-page > :global(.set-help) {
      position: sticky;
      top: 0;
    }

    .set-help-visual {
      display: none;
    }
  }

  /* Portrait: one door a row, its values under its name; a section's rows run the full width with their help under. */
  @media (max-width: 700px) {
    .set-doors {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: none;
      grid-auto-flow: row;
      grid-auto-rows: minmax(calc(var(--row-h) * 2), auto);
      height: auto;
    }

    .set-door-row {
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--gap-xs) var(--gap);
    }

    .set-door-icon {
      grid-area: 1 / 1 / 3 / 2;
    }

    .set-door-name {
      grid-area: 1 / 2;
    }

    .set-door-values {
      grid-area: 2 / 2;
    }

    .set-door-go {
      grid-area: 1 / 3 / 3 / 4;
    }

    .set-page {
      grid-template-columns: minmax(0, 1fr);
      height: auto;
    }

    .set-page > :global(.set-rows),
    .set-page > :global(.set-help) {
      max-height: none;
    }
  }
</style>
