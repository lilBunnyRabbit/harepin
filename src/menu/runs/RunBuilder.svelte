<script lang="ts">
  import { CarClass } from "../../car/pi";
  import { limit_text } from "../../car/car-pick";
  import { PRESETS } from "../../car/presets";
  import { ANY, Difficulty, RUN_TYPES, car_code, custom, new_seed, parse_car, type RunOptions, type RunPick, type RunType } from "../../runs/runs";
  import type { WorldKind } from "../../worldgen/types";
  import type { Menu } from "../page";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import Row from "../ui/Row.svelte";
  import RowList from "../ui/RowList.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Select from "../ui/Select.svelte";
  import type { Option } from "../ui/types";
  import { COPIED_MS } from "../widgets";
  import { car_text, pick_text, run_link, world_name } from "./run-text";

  interface Props {
    menu: Menu;
  }

  let { menu }: Props = $props();

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
  const TYPES: Option<string>[] = [{ value: ANY, label: "Any type" }, ...RUN_TYPES.map((type) => ({ value: type.id, label: type.name }))];
  const ALL_KINDS = [...new Set(RUN_TYPES.flatMap((type) => type.kinds))];
  const CARS: Option<string>[] = [
    { value: ANY, label: "Any car" },
    ...Object.values(CarClass).map((cap) => ({ value: cap, label: limit_text(cap) })),
    ...PRESETS.map((preset) => ({ value: car_code({ preset: preset.name }), label: `${preset.name} car` })),
  ];

  let type = $state<string>(ANY);
  let kind = $state<string>(ANY);
  let choice = $state<string>(ANY);
  let difficulty = $state<Difficulty>(Difficulty.NORMAL);
  let car = $state<string>(ANY);
  let built = $state.raw<RunPick | null>(null);
  let copied = $state("");

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

  function generate() {
    built = custom(options, new_seed());
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

<div class="builder">
  <Card list label="Build an event">
    <div class="head"><SectionHead title="Build an event" /></div>
    <RowList divided label="Event options">
      <Row label="Type" help={def ? `Runs on ${kinds.length} worlds` : "Any mode the dice pick"} stack>
        {#snippet control()}<Select options={TYPES} value={type} label="Type" onchange={pick_type} />{/snippet}
      </Row>
      <Row label="World" help="A new map of it, seeded on Generate" stack>
        {#snippet control()}<Select options={worlds} bind:value={kind} label="World" onchange={changed} />{/snippet}
      </Row>
      {#if def?.choice}
        <Row label={def.choice.label} help={def.id === "race" ? "Routes differ per map: the nearest one stands in" : "Narrows the levels it picks from"} stack>
          {#snippet control()}<Segmented options={choices} bind:value={choice} label={def.choice?.label ?? ""} onchange={changed} />{/snippet}
        </Row>
      {/if}
      <Row label="Difficulty" help={DIFFICULTY_HELP[difficulty]} stack>
        {#snippet control()}<Segmented options={DIFFICULTIES} bind:value={difficulty} label="Difficulty" onchange={changed} />{/snippet}
      </Row>
      <Row label="Car" help="A class limit lets you pick your car; a preset car is lent for the run" stack>
        {#snippet control()}<Select options={CARS} bind:value={car} label="Car" onchange={changed} />{/snippet}
      </Row>
    </RowList>
    <div class="actions">
      <Button variant="primary" icon="icon-dice" onclick={generate}>{built ? "Generate again" : "Generate"}</Button>
    </div>
  </Card>

  {#if built}
    <Card list label="Your event">
      <div class="head"><SectionHead eyebrow="Your event" title={pick_text(built)} /></div>
      <RowList label="Your event">
        <Row label={car_text(built.car)} help={`${DIFFICULTIES.find((d) => d.value === built?.difficulty)?.label} star marks · season stars within today's cap`} />
      </RowList>
      <div class="actions">
        <Button icon="icon-share" onclick={() => built && copy_link(built)}>{copied || "Copy link"}</Button>
        <Button variant="primary" onclick={() => built && menu.host.start_run(built.id)}>Go</Button>
      </div>
    </Card>
  {/if}
</div>

<style>
  .builder {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    align-items: start;
    gap: var(--space-5);
  }

  .head {
    padding: var(--space-4) var(--space-4) var(--space-2);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  @media (max-width: 900px) {
    .builder {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
