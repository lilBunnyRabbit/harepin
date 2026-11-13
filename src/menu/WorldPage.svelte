<script lang="ts">
  import { untrack } from "svelte";
  import { GoalId } from "../goals/goals";
  import type { MapData } from "../worldgen/map";
  import { KINDS, plain_map, type MapSpec } from "../worldgen/kinds/kinds";
  import { custom_code, map_code, parse_map_code } from "../worldgen/kinds/map-code";
  import type { OptionDef } from "../worldgen/kinds/options";
  import type { WorldKind } from "../worldgen/types";
  import { LISTED, WORLDS } from "../worlds/worlds";
  import MapLegend, { type LegendItem } from "./MapLegend.svelte";
  import WorldMap from "./WorldMap.svelte";
  import { FALLBACK } from "./map-note";
  import { keep_thumb, thumb_url } from "./map-thumb";
  import { invite_link } from "./page";
  import { MAP_NAME_LENGTH, SAVED_MAPS_MAX } from "./prefs";
  import Button from "./ui/Button.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import Row from "./ui/Row.svelte";
  import ScrollArea from "./ui/ScrollArea.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import Segmented from "./ui/Segmented.svelte";
  import Slider from "./ui/Slider.svelte";
  import TextField from "./ui/TextField.svelte";
  import Tile from "./ui/Tile.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { COPIED_MS, preview, random_seed } from "./widgets";
  import { WorldMap as MapView } from "./world-map.svelte";

  let { menu, live, shown }: PageProps = $props();

  const PLAYERS_MS = 250;
  const NEWER = "Made in a newer Harepin: update to drive it";
  const BAD = "Not a map code";
  const HINT = "Got a code from a friend? Type it in.";
  const COPIES = [
    { label: "Copy code", icon: "icon-edit" },
    { label: "Copy link", icon: "icon-share" },
  ] as const;

  const host = $derived(menu.host);
  const map = new MapView();
  const start = untrack((): MapSpec => {
    const { seed, kind, levels } = menu.host;
    return { seed, kind, levels: KINDS[kind].options.map((o, i) => levels[i] ?? o.normal) };
  });

  let chosen = $state.raw(start);
  let ready = $state.raw<MapData | null>(null);
  let code_text = $state(map_code(start));
  let typing = false;
  let bad = $state<string | null>(null);
  let note = $state(untrack(() => menu.host.map_note));
  let advanced = $state(false);
  let name = $state("");
  let copied = $state<Record<string, string>>({});
  let thumbs = $state<Record<string, string>>({});

  map.on_ready = (data) => (ready = data);

  const here = $derived(chosen.seed === host.seed && chosen.kind === host.kind && custom_code(chosen) === host.code);
  const world = $derived(WORLDS[chosen.kind]);
  const code = $derived(map_code(chosen));
  const fallback = $derived(ready?.fallback === true);
  const title = $derived(`${world.name} · ${fallback ? map_code(plain_map(chosen.kind, chosen.seed)) : code}`);
  const facts = $derived(world.facts(ready ? ready.facts : null).filter(([value]) => value !== "0"));
  const hint = $derived(bad ?? (fallback ? FALLBACK : (note ?? HINT)));
  const knobs = $derived(KINDS[chosen.kind].options.map((option, at) => ({ option, at })));
  const saved = $derived(live.prefs.saved_maps.map((entry) => ({ ...entry, read: parse_map_code(entry.code) })));
  const steps = $derived(knobs.length ? ["Pick a world", "Pick a map", "Tune it", "Save it"] : ["Pick a world", "Pick a map", "Save it"]);

  const legend: LegendItem[] = $derived([
    { label: "Circuit", swatch: "var(--accent)" },
    { label: "Start", swatch: "var(--primary)" },
    { label: "Checkpoints", swatch: "var(--foreground)" },
    { label: "Jumps", swatch: "var(--secondary)" },
    // The map's pad tone, tones.pad: the accent a step lighter, never mixed with another brand colour.
    ...(world.pads ? [{ label: "Boost", swatch: "oklch(from var(--accent) calc(l + 0.14) c h)" }] : []),
  ]);

  $effect(() => {
    if (!shown) return;
    host.goals.done(GoalId.MAP);
    const { seed, kind, levels } = untrack(() => chosen);
    map.show(seed, kind, true, levels);
    const players = () => {
      if (document.hidden) return;
      const on = untrack(() => here);
      map.show_players(on ? host.map_players() : []);
      map.show_markers(on ? host.map_markers() : []);
    };
    const timer = window.setInterval(players, PLAYERS_MS);
    players();
    return () => {
      clearInterval(timer);
      map.stop();
    };
  });

  $effect(() => {
    if (!shown) return;
    for (const entry of saved) {
      if (!entry.read.ok || untrack(() => thumbs[entry.code])) continue;
      thumb_url(entry.read.map).then(
        (url) => (thumbs[entry.code] = url),
        (error: unknown) => console.warn("map thumb: generation failed", error),
      );
    }
  });

  function choose(next: MapSpec, now: boolean) {
    chosen = next;
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

  function drive() {
    if (here || bad) return;
    menu.drive(chosen.seed, chosen.kind, chosen.levels);
  }

  async function copy(label: string) {
    const text = label === "Copy code" ? code : invite_link(host.room, chosen.seed, chosen.kind, custom_code(chosen));
    try {
      await navigator.clipboard.writeText(text);
      copied[label] = "Copied";
    } catch (error) {
      console.warn("settings: clipboard refused", error);
      copied[label] = "Copy failed";
    }
    setTimeout(() => delete copied[label], COPIED_MS);
  }

  function save() {
    const label = [...name.replace(/\p{C}/gu, "").trim()].slice(0, MAP_NAME_LENGTH).join("").trim();
    if (!label) return;
    if (ready) keep_thumb(chosen, ready);
    const others = live.prefs.saved_maps.filter((m) => m.name !== label);
    live.set("saved_maps", [{ name: label, code }, ...others].slice(0, SAVED_MAPS_MAX));
    name = "";
  }

  function remove(index: number) {
    live.set(
      "saved_maps",
      live.prefs.saved_maps.filter((_, i) => i !== index),
    );
  }

  const step = (text: string) => `${steps.indexOf(text) + 1}`;
  const level_of = (kind: WorldKind, at: number) => (chosen.kind === kind ? chosen.levels[at] : KINDS[kind].options[at].normal);
</script>

{#snippet head(text: string)}
  <h3 class="step"><i>{step(text)}</i><span>{text}</span></h3>
{/snippet}

<div class="world">
  <ScrollArea class="side" label="Map settings">
    <ScrollArea class="picks">
      <div class="steps">
        {@render head("Pick a world")}
        <div class="worlds" role="radiogroup" aria-label="World">
          {#each LISTED as { kind, name, pick } (kind)}
            <Tile title={name} meta={pick} thumb={preview(kind)} selected={kind === chosen.kind} onclick={() => choose(plain_map(kind, chosen.seed), true)} />
          {/each}
        </div>

        {@render head("Pick a map")}
        <div class="code">
          <TextField
            bind:value={code_text}
            mono
            class="code-field"
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
          <Button icon="icon-dice" class="dice" onclick={() => choose({ ...chosen, seed: random_seed() }, true)}><span class="dice-label">New random map</span></Button>
        </div>
        <p class="hint" class:error={bad !== null || fallback || note !== null}>{hint}</p>
      </div>
    </ScrollArea>

    <ScrollArea class="tune">
      <div class="steps">
        {#if knobs.length}
          <div class="step-head">
            {@render head("Tune it")}
            <Button variant="quiet" size="sm" onclick={() => choose(plain_map(chosen.kind, chosen.seed), true)}>Reset</Button>
          </div>
          <div class="knobs">
            {#each knobs.filter((k) => !k.option.more) as { option, at } (`${chosen.kind}:${option.field}`)}
              {@render knob(option, at)}
            {/each}
            {#if knobs.some((k) => k.option.more)}
              <Row label={advanced ? "Fewer settings" : "Advanced"} help="Ridges, water, town size and the rest of this world's settings." onclick={() => (advanced = !advanced)} />
              {#if advanced}
                {#each knobs.filter((k) => k.option.more) as { option, at } (`${chosen.kind}:${option.field}`)}
                  {@render knob(option, at)}
                {/each}
              {/if}
            {/if}
          </div>
        {/if}

        {@render head("Save it")}
        <div class="code">
          <TextField
            bind:value={name}
            class="name-field"
            maxlength={MAP_NAME_LENGTH}
            placeholder="Name this map"
            aria-label="Map name"
            onkeydown={(event) => {
              if (event.key === "Enter") save();
            }}
          />
          <Button onclick={save} disabled={!name.trim()}>Save</Button>
        </div>
        {#if saved.length}
          <ul class="saved">
            {#each saved as entry, index (entry.name)}
              <li>
                <Tile size="sm" title={entry.name} meta={entry.code} thumb={thumbs[entry.code]} onclick={() => entry.read.ok && choose(entry.read.map, true)} />
                <IconButton icon="icon-close" label={`Delete ${entry.name}`} onclick={() => remove(index)} />
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </ScrollArea>
  </ScrollArea>

  <div class="preview">
    <WorldMap {map} label={`Map of ${world.map_label} ${chosen.seed}`} />
  </div>

  <div class="about">
    <b class="map-name">{title}</b>
    {#if facts.length}
      <dl class="facts">
        {#each facts as [value, label] (label)}
          <div><dt>{label}</dt><dd>{value}</dd></div>
        {/each}
      </dl>
    {/if}
    <div class="legend"><MapLegend items={legend} /></div>
  </div>

  <div class="drive-bar">
    <Button variant="primary" size="lg" disabled={here || bad !== null} title={here ? "" : `Reloads room ${host.room} on ${world.name} ${code}`} onclick={drive}>
      {here ? "You're on this map" : "Drive this map"}
    </Button>
    <div class="shares">
      {#each COPIES as { label, icon } (label)}
        <Button variant="quiet" {icon} aria-label={label} title={label} onclick={() => copy(label)}><span class="share-label">{copied[label] ?? label}</span></Button>
      {/each}
    </div>
  </div>
</div>

{#snippet knob(option: OptionDef, at: number)}
  <div class="knob">
    <span class="knob-text">
      <span class="knob-name">{option.name}</span>
      <small>{option.help}</small>
    </span>
    {#if option.slider}
      <Slider
        value={level_of(chosen.kind, at)}
        min={0}
        max={option.labels.length - 1}
        label={option.name}
        format={(level) => option.labels[level] ?? ""}
        onchange={(level) => set_level(at, level)}
      />
    {:else}
      <Segmented
        value={level_of(chosen.kind, at)}
        label={option.name}
        options={option.labels.map((label, value) => ({ value, label }))}
        onchange={(level) => set_level(at, level)}
      />
    {/if}
  </div>
{/snippet}

<style>
  .world {
    display: grid;
    grid-template:
      "picks map tune" minmax(0, 1fr)
      "actions about tune" auto
      / minmax(280px, 340px) minmax(0, 1fr) minmax(320px, 400px);
    gap: var(--space-5) var(--space-6);
    height: 100%;
    min-height: 0;
  }

  .world > :global(.side) {
    display: contents;
  }

  .world :global(.picks) {
    grid-area: picks;
  }

  .world :global(.tune) {
    grid-area: tune;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .step {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 700;
  }

  .steps > .step:not(:first-child),
  .steps > .step-head:not(:first-child) {
    margin-top: var(--space-4);
  }

  .step i {
    display: grid;
    place-items: center;
    width: var(--space-6);
    height: var(--space-6);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    font-style: normal;
  }

  .step-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .worlds {
    display: grid;
    gap: var(--space-2);
  }

  .code {
    display: flex;
    gap: var(--space-2);
  }

  .code > :global(.code-field),
  .code > :global(.name-field) {
    flex: 1;
  }

  .hint {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .hint.error {
    color: var(--foreground);
    font-weight: 600;
  }

  .knobs {
    display: grid;
    gap: var(--space-4);
  }

  .knob {
    display: grid;
    gap: var(--space-2);
  }

  .knob-text {
    display: grid;
    gap: var(--space-0);
  }

  .knob-name {
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.3;
  }

  .knob small {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
  }

  .saved {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .saved li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
  }

  .preview {
    grid-area: map;
    min-width: 0;
    min-height: 0;
  }

  .about {
    grid-area: about;
    display: grid;
    justify-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .map-name {
    font-size: var(--text-lg);
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-1) var(--space-5);
    margin: 0;
  }

  .facts div {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
  }

  .facts dd {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .facts dt {
    color: var(--set-dim);
    font-size: var(--text-md);
  }

  .drive-bar {
    grid-area: actions;
    display: grid;
    gap: var(--space-2);
  }

  .shares {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-1);
  }

  @media (max-width: 1100px) {
    .world {
      grid-template:
        "side map" minmax(0, 1fr)
        "actions about" auto
        / minmax(280px, 340px) minmax(0, 1fr);
      gap: var(--space-4) var(--space-5);
    }

    .world > :global(.side) {
      display: block;
      grid-area: side;
    }

    .steps {
      padding-bottom: var(--space-5);
    }

    .map-name,
    .legend {
      display: none;
    }

    .facts dd {
      font-size: var(--text-lg);
    }
  }

  @media (max-width: 600px) {
    .world {
      grid-template: "map" auto "about" auto "side" auto "actions" auto / minmax(0, 1fr);
      gap: var(--space-5);
      height: auto;
    }

    .preview {
      aspect-ratio: 1;
    }

    /* Down over the scroller's focus-ring padding, so no strip of the page shows under the bar. */
    .drive-bar {
      position: sticky;
      bottom: calc(-1 * var(--focus-room, 0px));
      padding-block: var(--space-4);
      border-top: 1px solid var(--set-line);
      background: var(--set-panel);
    }
  }

  @media (max-height: 500px) {
    .world {
      gap: var(--space-3) var(--space-4);
    }

    .dice-label,
    .share-label {
      display: none;
    }

    .drive-bar {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }

    .shares {
      flex-wrap: nowrap;
    }
  }
</style>
