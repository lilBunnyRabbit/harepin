<script lang="ts">
  import { tick } from "svelte";
  import { CarClass } from "../../car/pi";
  import { limit_text } from "../../car/car-pick";
  import { open_presets, unlocks } from "../../career/rewards";
  import { ANY, Difficulty, LAPS, RUN_TYPES, RunType, car_code, custom, new_seed, parse_car, type RunOptions, type RunPick } from "../../runs/runs";
  import { plain_map } from "../../worldgen/kinds/kinds";
  import type { MapData } from "../../worldgen/map";
  import type { WorldKind } from "../../worldgen/types";
  import type { CarPicker } from "../car-pick.svelte";
  import { bare_enter } from "../drive-picks";
  import { RUN_BUILD_PAGE, type StartTarget } from "../events-view";
  import MenuFrame from "../MenuFrame.svelte";
  import StartSheet from "../StartSheet.svelte";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import KeyLink from "../ui/KeyLink.svelte";
  import PrimaryAction from "../ui/PrimaryAction.svelte";
  import Row from "../ui/Row.svelte";
  import RowList from "../ui/RowList.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Select from "../ui/Select.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import type { Option } from "../ui/types";
  import { COPIED_MS } from "../widgets";
  import { map_request, map_worker } from "../world-map.svelte";
  import { band_text, route_text } from "../../runs/run-route";
  import { car_text, pick_text, run_link, world_name } from "./run-text";

  interface Props extends PageProps {
    picker: CarPicker;
  }

  let { menu, live, shown, picker }: Props = $props();

  const DIFFICULTIES: Option<Difficulty>[] = [
    { value: Difficulty.RELAXED, label: "Relaxed" },
    { value: Difficulty.NORMAL, label: "Normal" },
    { value: Difficulty.HARD, label: "Hard" },
  ];
  const DIFFICULTY_HELP: Record<Difficulty, string> = {
    relaxed: "Star marks eased: 15% more time, or fewer points",
    normal: "The mode's own star marks",
    hard: "Star marks tightened: 10% less time, or more points",
  };
  const LAP_OPTIONS: Option<number>[] = LAPS.map((n) => ({ value: n, label: n === 1 ? "1 lap" : `${n} laps` }));
  const TYPES: Option<string>[] = [{ value: ANY, label: "Any type" }, ...RUN_TYPES.map((type) => ({ value: type.id, label: type.name }))];
  const ALL_KINDS = [...new Set(RUN_TYPES.flatMap((type) => type.kinds))];
  const CARS: Option<string>[] = $derived([
    { value: ANY, label: "Random class" },
    ...Object.values(CarClass).map((cap) => ({ value: cap, label: limit_text(cap) })),
    ...open_presets(unlocks(live.stars).cars).map((preset) => ({ value: car_code({ preset: preset.name }), label: `${preset.name} car` })),
  ]);

  let type = $state<string>(ANY);
  let kind = $state<string>(ANY);
  let choice = $state<string>(ANY);
  let difficulty = $state<Difficulty>(Difficulty.NORMAL);
  let car = $state<string>(ANY);
  let laps = $state(1);
  let built = $state.raw<RunPick | null>(null);
  let copied = $state("");
  let route = $state<string | null>(null);

  // A race's route is the map's: its plan is generated off the main thread, as the world map's is, to name it here.
  $effect(() => {
    const pick = built;
    route = null;
    if (!pick || (pick.type !== RunType.RACE && pick.type !== RunType.TRAP)) return;
    const worker = map_worker();
    worker.addEventListener("message", (event: MessageEvent<MapData>) => {
      worker.terminate();
      route = route_text(pick, event.data.routes);
    });
    worker.postMessage(map_request(pick.seed, pick.kind, plain_map(pick.kind, pick.seed).levels));
    return () => worker.terminate();
  });

  const def = $derived(RUN_TYPES.find((t) => t.id === type) ?? null);
  const kinds = $derived(def?.kinds ?? ALL_KINDS);
  const worlds = $derived<Option<string>[]>([{ value: ANY, label: "Any world" }, ...kinds.map((k) => ({ value: k, label: world_name(k) }))]);
  const choices = $derived<Option<string>[]>(def?.choice ? [{ value: ANY, label: "Any" }, ...def.choice.options.map((o) => ({ value: o.id, label: o.label }))] : []);

  const options = $derived<RunOptions>({
    type: (def?.id ?? null) as RunType | null,
    kind: kind === ANY ? null : (kind as WorldKind),
    choice: choice === ANY ? null : choice,
    difficulty,
    car: parse_car(car) ?? null,
    laps: def?.id === RunType.RACE ? laps : 1,
  });

  // A type that can't run on the picked world, or has no such option, drops back to Any for it.
  function pick_type(next: string) {
    type = next;
    const to = RUN_TYPES.find((t) => t.id === next);
    if (to && kind !== ANY && !to.kinds.includes(kind as WorldKind)) kind = ANY;
    if (!to?.choice?.options.some((o) => o.id === choice)) choice = ANY;
    built = null;
  }

  function changed() {
    built = null;
  }

  let event_card: HTMLElement | undefined = $state();
  let target = $state.raw<StartTarget | null>(null);

  export function back(): boolean {
    if (!target) return false;
    target = null;
    return true;
  }

  function go() {
    if (built) target = { kind: "run", pick: built };
    else void generate();
  }

  function key(event: KeyboardEvent) {
    if (!shown || target || event.defaultPrevented || !bare_enter(event)) return;
    event.preventDefault();
    go();
  }

  async function generate() {
    built = custom(options, new_seed());
    await tick();
    // On a phone the card lands below the fold, so Generate would only change its own label.
    event_card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  async function copy_link(pick: RunPick) {
    try {
      await navigator.clipboard.writeText(run_link(pick));
      copied = "Copied";
    } catch (error) {
      console.warn("runs: clipboard refused", error);
      copied = "Copy failed";
    }
    setTimeout(() => (copied = ""), COPIED_MS);
  }
</script>

<svelte:window onkeydown={key} />

{#snippet links()}
  {#if built}<KeyLink onclick={() => built && copy_link(built)}>{copied || "Copy link"}</KeyLink>{/if}
{/snippet}

{#snippet primary()}
  <PrimaryAction onclick={go}>{built ? `Run ${pick_text(built)}` : "Roll this run"}</PrimaryAction>
{/snippet}

{#if target}
  <StartSheet {menu} {picker} {target} eyebrow="Events · Runs" title="Build a run" {shown} onclose={() => (target = null)} />
{:else}
  <MenuFrame {menu} id={RUN_BUILD_PAGE} eyebrow="Events · Runs" title="Build a run" veil={0.55} {links} note="Pick what matters; the dice fill in the rest." {primary}>
  <div class="builder">
    <Card list label="Build a run">
      <div class="head"><SectionHead title="What to run" /></div>
      <RowList divided label="Event options">
        <Row label="Type" help={def ? `Runs on ${kinds.length} worlds` : "Any mode the dice pick"} stack>
          {#snippet control()}<Select options={TYPES} value={type} label="Type" onchange={pick_type} />{/snippet}
        </Row>
        <Row label="World" help="A new map of it on every roll" stack>
          {#snippet control()}<Select options={worlds} bind:value={kind} label="World" onchange={changed} />{/snippet}
        </Row>
        {#if def?.choice}
          <Row label={def.choice.label} help={def.id === "race" ? "Routes differ per map: the nearest one stands in" : "Narrows the levels it picks from"} stack>
            {#snippet control()}<Segmented options={choices} bind:value={choice} label={def.choice?.label ?? ""} onchange={changed} />{/snippet}
          </Row>
        {/if}
        {#if def?.id === RunType.RACE}
          <Row label="Laps" help={laps > 1 ? "Circuits only, star marks for the whole run" : "One run of any route"} stack>
            {#snippet control()}<Segmented options={LAP_OPTIONS} bind:value={laps} label="Laps" onchange={changed} />{/snippet}
          </Row>
        {/if}
        <Row label="Difficulty" help={DIFFICULTY_HELP[difficulty]} stack>
          {#snippet control()}<Segmented options={DIFFICULTIES} bind:value={difficulty} label="Difficulty" onchange={changed} />{/snippet}
        </Row>
        <Row label="Car" help="A class limit lets you pick your car; a preset car is lent; Random class rolls a limit" stack>
          {#snippet control()}<Select options={CARS} bind:value={car} label="Car" onchange={changed} />{/snippet}
        </Row>
      </RowList>
    </Card>
  
    {#if built}
      <div class="event" bind:this={event_card}>
      <Card list label="Your run">
        <div class="head"><SectionHead eyebrow="Your run" title={pick_text(built)} /></div>
        <RowList divided label="Your run">
          {#if built.type === RunType.RACE || built.type === RunType.TRAP}
            <Row label={route ?? "Finding the route…"} help={built.laps > 1 ? `${built.laps} laps · circuits only, the nearest one stands in` : (band_text(built) ?? "Route of the map")} />
          {/if}
          <Row label={car_text(built.car)} help={`${DIFFICULTIES.find((d) => d.value === built?.difficulty)?.label} star marks · season stars within today's cap`} />
        </RowList>
        <div class="actions">
          <Button icon="icon-dice" onclick={generate}>Roll again</Button>
        </div>
      </Card>
      </div>
    {/if}
  </div>
  </MenuFrame>
{/if}

<style>
  .builder {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    align-items: start;
    gap: var(--gap);
    max-height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .head {
    padding: var(--gap-md) var(--gap-md) var(--gap-sm);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--gap-md);
    padding: var(--gap-md);
  }

  @media (max-width: 900px) {
    .builder {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
