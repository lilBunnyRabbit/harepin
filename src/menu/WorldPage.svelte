<script lang="ts">
  import { untrack } from "svelte";
  import { GoalId } from "../goals/goals";
  import type { MapData } from "../worldgen/map";
  import { KINDS, plain_map, type MapSpec } from "../worldgen/kinds/kinds";
  import { custom_code, map_code, parse_map_code } from "../worldgen/kinds/map-code";
  import type { WorldKind } from "../worldgen/types";
  import { map_name } from "../worlds/map-name";
  import { LISTED, WORLDS } from "../worlds/worlds";
  import { bare_enter, link_key } from "./drive-picks";
  import { FALLBACK } from "./map-note";
  import { CUSTOM_PAGE } from "./events-view";
  import { kind_map, MAKE_PAGE } from "./maps";
  import MenuFrame from "./MenuFrame.svelte";
  import { invite_link } from "./page";
  import Button from "./ui/Button.svelte";
  import Card from "./ui/Card.svelte";
  import Icon from "./ui/Icon.svelte";
  import Kbd from "./ui/Kbd.svelte";
  import KeyLink from "./ui/KeyLink.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import Slider from "./ui/Slider.svelte";
  import TextField from "./ui/TextField.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { COPIED_MS, preview, random_seed } from "./widgets";
  import WorldMap from "./WorldMap.svelte";
  import { WorldMap as MapView } from "./world-map.svelte";

  let { menu, live, shown }: PageProps = $props();

  const NEWER = "Made in a newer Harepin: update to drive it";
  const BAD = "Not a map code";
  const COPY = { code: "Copy", link: "Copy link" } as const;
  type CopyKind = keyof typeof COPY;

  const host = $derived(menu.host);
  const map = new MapView();
  const start = untrack((): MapSpec => {
    const { seed, kind, levels } = menu.host;
    return { seed, kind, levels: KINDS[kind].options.map((o, i) => levels[i] ?? o.normal) };
  });

  const kept = new Map<WorldKind, readonly number[]>([[start.kind, start.levels]]);

  let chosen = $state.raw(start);
  let ready = $state.raw<MapData | null>(null);
  let code_text = $state(map_code(start));
  let typing = false;
  let bad = $state<string | null>(null);
  let note = $state(untrack(() => menu.host.map_note));
  let copied = $state<Partial<Record<CopyKind, string>>>({});

  map.on_ready = (data) => (ready = data);

  const here = $derived(chosen.seed === host.seed && chosen.kind === host.kind && custom_code(chosen) === host.code);
  const world = $derived(WORLDS[chosen.kind]);
  const code = $derived(map_code(chosen));
  const custom = $derived(custom_code(chosen) !== null);
  const fallback = $derived(ready?.fallback === true);
  const title = $derived(map_name(fallback ? plain_map(chosen.kind, chosen.seed) : chosen, ready?.towns ?? []));
  const facts = $derived(
    world
      .facts(ready ? ready.facts : null)
      .filter(([value]) => value !== "0")
      .map(([value, label]) => `${value} ${label}`)
      .join(" · "),
  );
  const warn = $derived(bad ?? (fallback ? FALLBACK : note));
  const knobs = $derived(KINDS[chosen.kind].options.map((option, at) => ({ option, at })));

  $effect(() => {
    if (!shown) return;
    host.goals.done(GoalId.MAP);
    const { seed, kind, levels } = untrack(() => chosen);
    map.show(seed, kind, true, levels);
    return () => map.stop();
  });

  function choose(next: MapSpec, now: boolean) {
    chosen = next;
    kept.set(next.kind, next.levels);
    ready = null;
    bad = null;
    note = null;
    if (!typing) code_text = map_code(next);
    map.show(next.seed, next.kind, now, next.levels);
  }

  function set_level(at: number, level: number) {
    if (chosen.levels[at] === level) return;
    const levels = chosen.levels.map((l, i) => (i === at ? level : l));
    choose({ ...chosen, levels: KINDS[chosen.kind].clamp?.(levels) ?? levels }, false);
  }

  function read_code() {
    const read = parse_map_code(code_text, chosen.kind);
    if (read.ok) return choose(read.map, false);
    bad = read.why === "newer" ? NEWER : BAD;
  }

  // Focus only aims: a tap or Enter picks the kind, so walking across the cards keeps the custom values. Each kind
  // comes back with the values it was left on. Enter on the kind already picked is the primary's.
  function press_kind(click: MouseEvent, kind: WorldKind) {
    if (kind !== chosen.kind) choose(kind_map(kept, kind, chosen.seed), true);
    else if (click.detail === 0) drive();
  }

  const roll = () => choose({ ...chosen, seed: random_seed() }, true);

  function drive() {
    if (bad) return;
    menu.drive(chosen.seed, chosen.kind, chosen.levels);
  }

  function race() {
    if (bad) return;
    live.set("custom_race", { ...live.prefs.custom_race, map: here ? null : code, route: "" });
    menu.show(CUSTOM_PAGE);
  }

  async function copy(what: CopyKind) {
    const text = what === "code" ? code : invite_link(host.room, chosen.seed, chosen.kind, custom_code(chosen));
    try {
      await navigator.clipboard.writeText(text);
      copied[what] = "Copied";
    } catch (error) {
      console.warn("make a map: clipboard refused", error);
      copied[what] = "Copy failed";
    }
    setTimeout(() => delete copied[what], COPIED_MS);
  }

  function key(event: KeyboardEvent) {
    if (!shown) return;
    if (bare_enter(event)) {
      event.preventDefault();
      return drive();
    }
    if (link_key(event) === "r") roll();
  }
</script>

<svelte:window onkeydown={key} />

<MenuFrame {menu} id={MAKE_PAGE} eyebrow="Home · Maps" title="Make a map" veil={0.55} note={here ? "You are on this map" : `Loads the map in room ${host.room}`}>
  <div class="make">
    <Card pad="none" class="make-big" label={title}>
      <div class="make-shot">
        <WorldMap {map} label={`Map of ${title}`} />
      </div>
      <div class="make-side">
        <header>
          <span class="make-eyebrow">{world.name} · {custom ? "custom" : "rolled"}</span>
          <h2>{title}</h2>
          {#if facts}<span class="make-sub">{facts}</span>{/if}
        </header>

        <div class="make-group">
          <span class="make-eyebrow">Map code</span>
          <div class="make-code">
            <TextField
              bind:value={code_text}
              mono
              maxlength={64}
              autocapitalize="characters"
              spellcheck={false}
              enterkeyhint="go"
              aria-label="Map code"
              aria-invalid={bad !== null}
              oninput={read_code}
              onfocus={() => (typing = true)}
              onblur={() => {
                typing = false;
                if (!bad) code_text = code;
              }}
              onkeydown={(event) => {
                if (event.key === "Enter") drive();
              }}
            />
            <Button variant="quiet" onclick={() => copy("code")}>{copied.code ?? COPY.code}</Button>
          </div>
          {#if warn}<span class="make-sub make-warn">{warn}</span>{/if}
        </div>

        {#if knobs.length}
          <div class="make-group">
            <span class="make-eyebrow">Custom map</span>
            <div class="make-knobs">
              {#each knobs as { option, at } (`${chosen.kind}:${option.field}`)}
                <b title={option.help}>{option.name}</b>
                <Slider value={chosen.levels[at]} min={0} max={option.labels.length - 1} label={option.name} format={(level) => option.labels[level] ?? ""} onchange={(level) => set_level(at, level)} />
              {/each}
            </div>
            <span class="make-sub make-hint">Change a value and the map rolls again.</span>
          </div>
        {:else}
          <span class="make-sub">{world.name} has no values to change. Roll for another one.</span>
        {/if}
      </div>
    </Card>

    <div class="make-pick">
      <Card pad="sm" class="make-roll" label="Roll: a new map of this type" onclick={roll}>
        <span class="make-die"><Icon name="icon-dice" /></span>
        <span class="make-roll-text"><b>Roll</b><span class="make-sub">A new map of this type</span></span>
        <Kbd keys={["R"]} />
      </Card>
      <div class="make-kinds" role="radiogroup" aria-label="Map type">
        {#each LISTED as { kind, name } (kind)}
          {@const on = kind === chosen.kind}
          <Card pad="sm" flat class="make-kind" label={name} selected={on} onclick={(click) => press_kind(click, kind)}>
            {#snippet picture()}
              <img src={preview(kind)} alt="" decoding="async" />
            {/snippet}
            <span class="make-kind-name" data-on={on ? "" : undefined}>{#if on}<Icon name="icon-check" />{/if}{name}</span>
          </Card>
        {/each}
      </div>
    </div>
  </div>

  {#snippet links()}
    {#if custom}<KeyLink onclick={() => choose(plain_map(chosen.kind, chosen.seed), true)}>Reset values</KeyLink>{/if}
    <KeyLink onclick={race}>Race it with AI</KeyLink>
    <KeyLink onclick={() => copy("link")}>{copied.link ?? COPY.link}</KeyLink>
  {/snippet}
  {#snippet primary()}
    <PrimaryAction disabled={bad !== null} onclick={drive}>{here ? "Keep driving this map" : "Drive this map"}</PrimaryAction>
  {/snippet}
</MenuFrame>

<style>
  .make {
    --pick-w: calc(var(--top-h) * 8.5);
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--pick-w);
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .make > :global(.make-big) {
    flex-direction: row;
    gap: 0;
    overflow: hidden;
  }

  .make-shot {
    flex: none;
    height: 100%;
    max-width: 55%;
    aspect-ratio: 1;
  }

  .make-side {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--gap);
    min-width: 0;
    min-height: 0;
    padding: var(--pad);
    overflow-y: auto;
    scrollbar-width: none;
  }

  header,
  .make-group {
    display: grid;
    gap: var(--gap-sm);
    min-width: 0;
  }

  header {
    gap: var(--gap-xs);
  }

  .make-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: var(--type-h1);
    font-weight: 800;
    line-height: 1.1;
    text-wrap: balance;
  }

  .make-sub {
    color: var(--dim);
    font-size: var(--type-small);
  }

  .make-warn {
    color: var(--error);
  }

  .make-code {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    min-width: 0;
  }

  .make-code > :global(:first-child) {
    flex: 1;
    min-width: 0;
  }

  .make-knobs {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--gap-sm) var(--gap-md);
    font-size: var(--type-small);
  }

  .make-knobs b {
    font-weight: 700;
    white-space: nowrap;
  }

  .make-knobs :global(.ui-value) {
    min-width: 8em;
    color: var(--dim);
    font-size: var(--type-small);
    text-align: right;
  }

  .make-pick {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    min-width: 0;
    min-height: 0;
  }

  .make-pick > :global(.make-roll) {
    flex: none;
    flex-direction: row;
    align-items: center;
    gap: var(--gap);
  }

  .make-die {
    --icon-size: calc(var(--top-h) * 0.6);
    display: grid;
    flex: none;
    place-items: center;
    width: var(--top-h);
    height: var(--top-h);
    border-radius: var(--radius-sm);
    background: var(--primary);
    color: var(--background-darkest);
  }

  .make-roll-text {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .make-roll-text b {
    font-size: var(--type-h2);
    font-weight: 800;
    line-height: 1.1;
  }

  .make-kinds {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: minmax(0, 1fr);
    gap: var(--gap-sm);
    min-height: 0;
  }

  .make-kinds > :global(.make-kind) {
    border-radius: var(--radius-sm);
  }

  .make-kinds > :global(.make-kind > .ui-card-cap) {
    padding: var(--gap-xs) var(--gap-sm);
  }

  .make-kind-name {
    --icon-size: 1.15em;
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
    overflow: hidden;
    font-size: var(--type-small);
    font-weight: 700;
    white-space: nowrap;
  }

  .make-kind-name[data-on] {
    color: var(--cottontail);
  }

  @media (max-height: 500px) {
    .make {
      --pick-w: calc(var(--top-h) * 9);
    }

    h2 {
      font-size: var(--type-h2);
    }

    .make-hint {
      display: none;
    }

    .make-kinds {
      grid-auto-rows: calc(var(--top-h) * 2);
      padding: var(--mark-w);
      overflow-y: auto;
      scrollbar-width: none;
    }
  }

  /* A finger's slider thumb is taller than a line of text: each value gets a row that clears it. */
  @media (pointer: coarse) {
    .make-knobs {
      grid-auto-rows: var(--row-h);
    }
  }

  /* A portrait phone: the map over its values, then the roll and one row of kinds to swipe through. */
  @media (max-width: 700px) {
    .make {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto;
    }

    .make > :global(.make-big) {
      flex-direction: column;
    }

    .make-shot {
      width: 100%;
      max-width: none;
      height: 42%;
      aspect-ratio: auto;
    }

    h2 {
      font-size: var(--type-h2);
    }

    .make-kinds {
      flex: none;
      grid-template-columns: none;
      grid-auto-columns: 30%;
      grid-auto-flow: column;
      grid-auto-rows: calc(var(--top-h) * 2.2);
      padding: var(--mark-w);
      overflow-x: auto;
      scrollbar-width: none;
    }
  }
</style>
