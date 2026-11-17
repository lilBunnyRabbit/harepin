<script lang="ts">
  import { Difficulty } from "../ai/difficulty";
  import { RivalPick, field_presets } from "../ai/field-pick";
  import { CLASS_LABELS } from "../car/pi";
  import { LEVEL_MAX, LEVEL_MIN, MAX_RIVALS, RaceFormat, TIMES, custom_map, custom_route, custom_travel, grid_of, type CustomRace } from "../modes/custom-race";
  import { MAX_LAPS } from "../modes/race-laps";
  import { race_choices, type RaceChoice } from "../modes/races";
  import { KINDS } from "../worldgen/kinds/kinds";
  import type { MapData } from "../worldgen/map";
  import { map_code, parse_map_code } from "../worldgen/kinds/map-code";
  import { name_of } from "../worlds/map-name";
  import type { CarPicker } from "./car-pick.svelte";
  import { bare_enter } from "./drive-picks";
  import { CUSTOM_PAGE, FORMAT_NAMES, length_text, type StartTarget } from "./events-view";
  import MenuFrame from "./MenuFrame.svelte";
  import StartSheet from "./StartSheet.svelte";
  import Card from "./ui/Card.svelte";
  import Chip from "./ui/Chip.svelte";
  import PrimaryAction from "./ui/PrimaryAction.svelte";
  import Row from "./ui/Row.svelte";
  import ScrollArea from "./ui/ScrollArea.svelte";
  import RowList from "./ui/RowList.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import Segmented from "./ui/Segmented.svelte";
  import Select from "./ui/Select.svelte";
  import Slider from "./ui/Slider.svelte";
  import TextField from "./ui/TextField.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import type { Option } from "./ui/types";
  import { map_request, map_worker } from "./world-map.svelte";
  import "./events.css";

  interface Props extends PageProps {
    picker: CarPicker;
  }

  let { menu, live, shown, picker }: Props = $props();

  const HERE = "here";
  const CODE = "code";
  const MAPS: Option<string>[] = [
    { value: HERE, label: "This map" },
    { value: CODE, label: "Map code" },
  ];
  const FORMATS: Option<RaceFormat>[] = Object.values(RaceFormat).map((value) => ({ value, label: FORMAT_NAMES[value] }));
  const FORMAT_HELP: Record<RaceFormat, string> = {
    laps: "First over the line wins",
    knockout: "The last car drops out, again and again, until one is left",
    timed: "Ends on the clock; the car furthest round wins",
  };
  const MINUTES: Option<number>[] = TIMES.map((value) => ({ value, label: `${value} min` }));
  const DIFFICULTIES: Option<Difficulty>[] = [
    { value: Difficulty.EASY, label: "Easy" },
    { value: Difficulty.NORMAL, label: "Normal" },
    { value: Difficulty.HARD, label: "Hard" },
  ];
  const DIFFICULTY_HELP: Record<Difficulty, string> = { easy: "Slower, and they slip more often", normal: "The pace they were tuned at", hard: "Faster, with half the slips" };
  const CAR_PICKS: Option<RivalPick>[] = [
    { value: RivalPick.CLASS, label: "Your class" },
    { value: RivalPick.ANY, label: "Any class" },
    { value: RivalPick.PICKED, label: "Picked" },
  ];
  const AGGRESSION = ["Timid", "Careful", "Fair", "Pushy", "Ruthless"];
  const MISTAKES = ["Flawless", "Rare", "Some", "Often", "Sloppy"];
  const PRESETS = field_presets().map((preset) => ({ name: preset.name, class: CLASS_LABELS[preset.rated.class] }));
  const BAD = "Not a map code";

  const host = $derived(menu.host);
  const setup = $derived(live.prefs.custom_race);
  const here = $derived({ kind: host.kind, seed: host.seed, levels: host.levels });
  const away = $derived(custom_travel(setup, here));
  const map = $derived(custom_map(setup) ?? here);

  let code_text = $state("");
  let typing = $state(false);
  let bad = $state(false);
  let found = $state.raw<{ code: string; routes: RaceChoice[] } | null>(null);

  function patch(change: Partial<CustomRace>) {
    live.set("custom_race", { ...setup, ...change });
  }

  function pick_map(mode: string) {
    bad = false;
    patch({ map: mode === CODE ? map_code(here) : null });
  }

  function read_code(text: string) {
    code_text = text;
    const read = parse_map_code(code_text, here.kind);
    bad = !read.ok;
    if (read.ok) patch({ map: map_code(read.map) });
  }

  // Another map's circuits are only known once its plan is generated, off the main thread as the world map's is.
  $effect(() => {
    const to = away;
    if (!shown || !to) return;
    const code = map_code(to);
    if (KINDS[to.kind].rails) {
      found = { code, routes: [] };
      return;
    }
    const worker = map_worker();
    worker.addEventListener("message", (event: MessageEvent<MapData>) => {
      worker.terminate();
      found = { code, routes: race_choices(event.data.routes).filter((route) => route.closed) };
    });
    worker.postMessage(map_request(to.seed, to.kind, to.levels));
    return () => worker.terminate();
  });

  const routes = $derived(away ? (found?.code === map_code(away) ? found.routes : null) : host.custom_routes);
  const route = $derived(custom_route(routes ?? [], setup.route));
  const route_options = $derived<Option<string>[]>((routes ?? []).map((one) => ({ value: one.id, label: `${one.name} · ${(one.length / 1000).toFixed(1)} km` })));
  const route_help = $derived(routes === null ? "Reading the map…" : routes.length ? "Circuits an AI field can race" : "No circuit here for an AI field: pick another map");
  const timed = $derived(setup.format === RaceFormat.TIMED);
  const slot = $derived(grid_of(setup));
  const slots = $derived(Array.from({ length: setup.rivals + 1 }, (_, i) => i));
  const picked_help = $derived(setup.cars === RivalPick.CLASS ? "The cars closest to yours in rating" : setup.cars === RivalPick.ANY ? "A spread from the slowest car to the fastest" : setup.picked.length ? "They take turns down the grid" : "None picked yet: your class races");
  const summary = $derived(`${setup.rivals} ${setup.rivals === 1 ? "rival" : "rivals"} · ${timed ? length_text(setup) : setup.laps ? `${setup.laps} ${setup.laps === 1 ? "lap" : "laps"}` : "auto laps"} · from P${slot + 1}`);

  function toggle_preset(name: string) {
    patch({ picked: setup.picked.includes(name) ? setup.picked.filter((one) => one !== name) : [...setup.picked, name] });
  }

  let target = $state.raw<StartTarget | null>(null);

  export function back(): boolean {
    if (!target) return false;
    target = null;
    return true;
  }

  function go() {
    if (route) target = { kind: "custom", setup, map, route: route.name };
  }

  function key(event: KeyboardEvent) {
    if (!shown || target || event.defaultPrevented || !bare_enter(event)) return;
    event.preventDefault();
    go();
  }
</script>

<svelte:window onkeydown={key} />

{#snippet primary()}
  <PrimaryAction disabled={!route} onclick={go}>{route ? `Race ${route.name}` : routes === null ? "Reading the map…" : "No circuit here"}</PrimaryAction>
{/snippet}

{#if target}
  <StartSheet {menu} {picker} {target} eyebrow="Events · Free modes" title="Custom race" {shown} onclose={() => (target = null)} />
{:else}
  <MenuFrame {menu} id={CUSTOM_PAGE} eyebrow="Events · Free modes" title="Custom race" veil={0.55} note={`${summary}. Nothing is recorded, and it is kept for next time.`} {primary}>
    <div class="custom">
      <Card list label="The race">
        <ScrollArea class="custom-scroll">
          <div class="custom-head"><SectionHead eyebrow={away ? `Loads ${name_of(away)}` : host.map_name()} title="The race" /></div>
          <RowList divided label="Race options">
            <Row label="Map" help={away ? "Travels there when the race starts" : "Starts here, no loading"} stack>
              {#snippet control()}<Segmented options={MAPS} value={setup.map === null ? HERE : CODE} label="Map" onchange={pick_map} />{/snippet}
            </Row>
            {#if setup.map !== null}
              <div class="custom-extra">
                <TextField bind:value={() => (typing ? code_text : (setup.map ?? "")), read_code} mono maxlength={64} autocapitalize="characters" spellcheck={false} aria-label="Map code" aria-invalid={bad} onfocus={() => ((code_text = setup.map ?? ""), (typing = true))} onblur={() => ((typing = false), (bad = false))} />
                <span class="custom-hint" data-bad={bad ? "" : undefined}>{bad ? BAD : "Copy a code from Make a map"}</span>
              </div>
            {/if}
            <Row label="Route" help={route_help} stack>
              {#snippet control()}
                {#if route}<Select options={route_options} value={route.id} label="Route" onchange={(id) => patch({ route: id })} />{/if}
              {/snippet}
            </Row>
            <Row label="Format" help={FORMAT_HELP[setup.format]} stack>
              {#snippet control()}<Segmented options={FORMATS} value={setup.format} label="Format" onchange={(format) => patch({ format })} />{/snippet}
            </Row>
            {#if timed}
              <Row label="Time" help="The clock the race ends on" stack>
                {#snippet control()}<Segmented options={MINUTES} value={setup.minutes} label="Time" onchange={(minutes) => patch({ minutes })} />{/snippet}
              </Row>
            {:else}
              <Row label="Laps" help={setup.laps ? "Run to the line" : "Auto: about four minutes of racing"} stack>
                {#snippet control()}<Slider value={setup.laps} min={0} max={MAX_LAPS} label="Laps" format={(laps) => (laps ? String(laps) : "Auto")} onchange={(laps) => patch({ laps })} />{/snippet}
              </Row>
            {/if}
            <Row label="Your grid slot" help={slot === setup.rivals ? "From the back" : slot === 0 ? "On pole" : `${slot} ahead of you`} stack>
              {#snippet control()}<Slider value={slot + 1} min={1} max={setup.rivals + 1} label="Your grid slot" format={(n) => `P${n}`} onchange={(n) => patch({ grid: n > setup.rivals ? MAX_RIVALS : n - 1 })} />{/snippet}
            </Row>
            <div class="custom-extra">
              <div class="custom-grid" role="img" aria-label={`Starting grid: you start P${slot + 1} of ${slots.length}`}>
                <span class="custom-line"></span>
                {#each slots as i (i)}
                  <span class="custom-slot" data-you={i === slot ? "" : undefined} data-low={i % 2 ? "" : undefined} style:grid-column={i + 2}>{i === slot ? "You" : i + 1}</span>
                {/each}
              </div>
            </div>
          </RowList>
        </ScrollArea>
      </Card>

      <Card list label="The rivals">
        <ScrollArea class="custom-scroll">
          <div class="custom-head"><SectionHead eyebrow="AI drivers" title="The rivals" /></div>
          <RowList divided label="Rival options">
            <Row label="Rivals" help={`${setup.rivals + 1} cars on the grid`} stack>
              {#snippet control()}<Slider value={setup.rivals} min={1} max={MAX_RIVALS} label="Rivals" onchange={(rivals) => patch({ rivals })} />{/snippet}
            </Row>
            <Row label="Their cars" help={picked_help} stack>
              {#snippet control()}<Segmented options={CAR_PICKS} value={setup.cars} label="Their cars" onchange={(cars) => patch({ cars })} />{/snippet}
            </Row>
            {#if setup.cars === RivalPick.PICKED}
              <div class="custom-extra custom-cars" role="group" aria-label="Cars to race">
                {#each PRESETS as preset (preset.name)}
                  <Chip variant="toggle" bind:pressed={() => setup.picked.includes(preset.name), () => toggle_preset(preset.name)}>{preset.name}<span class="custom-class">{preset.class}</span></Chip>
                {/each}
              </div>
            {/if}
            <Row label="Difficulty" help={DIFFICULTY_HELP[setup.difficulty]} stack>
              {#snippet control()}<Segmented options={DIFFICULTIES} value={setup.difficulty} label="Difficulty" onchange={(difficulty) => patch({ difficulty })} />{/snippet}
            </Row>
            <Row label="Aggression" help="How hard they fight for a place" stack>
              {#snippet control()}<Slider value={setup.aggression} min={LEVEL_MIN} max={LEVEL_MAX} label="Aggression" format={(level) => AGGRESSION[level - 1]} onchange={(aggression) => patch({ aggression })} />{/snippet}
            </Row>
            <Row label="Mistakes" help="How often they miss a braking point" stack>
              {#snippet control()}<Slider value={setup.mistakes} min={LEVEL_MIN} max={LEVEL_MAX} label="Mistakes" format={(level) => MISTAKES[level - 1]} onchange={(mistakes) => patch({ mistakes })} />{/snippet}
            </Row>
          </RowList>
        </ScrollArea>
      </Card>
    </div>
  </MenuFrame>
{/if}

<style>
  .custom {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .custom > :global(.ui-card) {
    max-height: 100%;
  }

  .custom > :global(.ui-card > .custom-scroll) {
    min-height: 0;
  }

  .custom-head {
    padding: var(--gap-md) var(--gap-md) var(--gap-sm);
  }

  .custom-extra {
    display: grid;
    gap: var(--gap-xs);
    padding: var(--gap-sm) var(--gap-md) var(--gap-md);
  }

  .custom-hint {
    color: var(--dim);
    font-size: var(--type-small);
  }

  .custom-hint[data-bad] {
    color: var(--foreground);
    font-weight: 700;
  }

  .custom-cars {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap-sm);
  }

  .custom-class {
    color: var(--dim);
    font-family: var(--font-mono);
    font-weight: 500;
  }

  /* Pole on the left behind the line, each slot one back and on the other side, as the cars stand on the road. */
  .custom-grid {
    display: grid;
    grid-template-columns: var(--mark-w) repeat(8, minmax(0, 1fr));
    grid-template-rows: var(--chip-h-in) var(--chip-h-in);
    gap: var(--gap-xs);
    padding: var(--gap-sm);
    border-radius: var(--radius-sm);
    background: var(--row);
  }

  .custom-line {
    grid-row: 1 / 3;
    border-radius: var(--radius-full);
    background: var(--faint);
  }

  .custom-slot {
    display: grid;
    grid-row: 1;
    place-items: center;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-xs);
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: var(--type-small);
  }

  .custom-slot[data-low] {
    grid-row: 2;
  }

  .custom-slot[data-you] {
    border-color: var(--primary);
    background: var(--row-on);
    color: var(--foreground);
    font-weight: 700;
  }

  @media (max-height: 500px) {
    .custom {
      height: auto;
    }

    .custom > :global(.ui-card) {
      max-height: none;
    }
  }

  @media (orientation: portrait) and (max-width: 700px) {
    .custom {
      grid-template-columns: minmax(0, 1fr);
      height: auto;
    }

    .custom > :global(.ui-card) {
      max-height: none;
    }
  }
</style>
