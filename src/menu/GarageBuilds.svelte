<script lang="ts">
  import { tick } from "svelte";
  import { build_code, parse_build } from "../car/build";
  import { BUILD_NAME_LENGTH, free_build_name, renamed } from "../car/builds";
  import { CARS } from "../car/cars";
  import { rating, type Rating } from "../car/pi";
  import { PRESETS } from "../car/presets";
  import { car_facts, type CarFacts } from "./car-facts";
  import CarFactsLine from "./CarFactsLine.svelte";
  import type { Garage } from "./garage.svelte";
  import Badge from "./ui/Badge.svelte";
  import Button from "./ui/Button.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import SpecCard from "./ui/SpecCard.svelte";
  import TextField from "./ui/TextField.svelte";
  import { COPIED_MS } from "./widgets";

  interface Props {
    garage: Garage;
    sheet: HTMLElement | null;
  }

  let { garage, sheet }: Props = $props();

  const CONFIRM_MS = 3000;

  let name = $state("");
  let code = $state("");
  let code_error = $state("");
  let rename = $state("");
  let rename_error = $state("");
  let copy_label = $state("Copy");
  let armed = $state<string | null>(null);
  let disarm_timer = 0;

  const fitted = $derived(build_code(garage.current));
  const name_hint = $derived(free_build_name(garage.builds, CARS[garage.current.car].name));
  const saved = $derived(
    garage.builds.flatMap((build) => {
      const parsed = parse_build(build.code);
      return parsed ? [{ ...build, sub: CARS[parsed.car].name, rating: rating(parsed), facts: car_facts(parsed) }] : [];
    }),
  );
  const presets = $derived(
    PRESETS.flatMap((preset, index) => {
      const parsed = parse_build(preset.code);
      return parsed ? [{ ...preset, index, rating: rating(parsed), facts: car_facts(parsed) }] : [];
    }),
  );

  // A load swaps Load for its tag and a delete drops the row: focus stays on that row, else the next, else the one before.
  async function keep_place(event: Event, action: () => void) {
    const from = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const rows = () => [...(sheet?.querySelectorAll<HTMLElement>(".garage-build") ?? [])];
    const row = from?.closest<HTMLElement>(".garage-build");
    const at = row ? rows().indexOf(row) : -1;
    const from_rename = !!from?.closest(".garage-rename");
    action();
    await tick();
    if (!sheet || (document.activeElement instanceof HTMLElement && sheet.contains(document.activeElement)) || at < 0) return;
    const now = rows();
    for (const candidate of [...now.slice(at), ...now.slice(0, at).reverse()]) {
      const nodes = [...candidate.querySelectorAll<HTMLElement>("button, input")];
      const pick = (from_rename && candidate === now[at] && nodes.find((node) => node.dataset.rename !== undefined)) || nodes[0];
      if (pick) return pick.focus({ focusVisible: true });
    }
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (garage.save_build(name)) name = "";
  }

  function load_code(event: SubmitEvent) {
    event.preventDefault();
    const build = parse_build(code.trim());
    if (!build) {
      code_error = "That isn't a build code";
      return;
    }
    garage.load(build_code(build));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fitted);
      copy_label = "Copied";
    } catch (error) {
      console.warn("garage: clipboard refused", error);
      copy_label = "Copy failed";
    }
    setTimeout(() => (copy_label = "Copy"), COPIED_MS);
  }

  function start_rename(build_name: string) {
    armed = null;
    rename = build_name;
    rename_error = "";
    garage.renaming = build_name;
  }

  function finish_rename(event: SubmitEvent, build_name: string) {
    event.preventDefault();
    void keep_place(event, () => {
      rename_error = garage.store(renamed(garage.builds, build_name, rename)) ?? "";
    });
  }

  async function ask_delete(build_name: string) {
    clearTimeout(disarm_timer);
    armed = build_name;
    disarm_timer = window.setTimeout(() => (armed = null), CONFIRM_MS);
    await tick();
    sheet?.querySelector<HTMLElement>("[data-armed]")?.focus({ focusVisible: true });
  }

  function disarm() {
    clearTimeout(disarm_timer);
    armed = null;
  }
</script>

{#snippet entry(title: string, sub: string, build_code_of: string, entry_rating: Rating, facts: CarFacts, load: (event: Event) => void)}
  {#snippet line()}<CarFactsLine {facts} />{/snippet}
  {#snippet on_car()}<Badge tone="primary">On your car</Badge>{/snippet}
  <SpecCard
    {title}
    meta={sub}
    rating={entry_rating}
    meters={facts.meters}
    facts={line}
    tag={build_code_of === fitted ? on_car : undefined}
    selected={build_code_of === fitted}
    onclick={load}
  />
{/snippet}

<div class="garage-group">
  <SectionHead eyebrow="Save this car" />
  <form class="garage-form" onsubmit={save}>
    <TextField bind:value={name} name="build-name" placeholder={name_hint} maxlength={BUILD_NAME_LENGTH} aria-label="Build name" spellcheck={false} />
    <Button type="submit">Save</Button>
  </form>
</div>

<div class="garage-group">
  <SectionHead eyebrow="Your car's code" />
  <div class="garage-form">
    <code class="garage-code">{fitted}</code>
    <Button onclick={copy}>{copy_label}</Button>
  </div>
</div>

<div class="garage-group">
  <SectionHead eyebrow="A friend's code" />
  <form class="garage-form" onsubmit={load_code}>
    <TextField
      bind:value={code}
      name="build-code"
      mono
      placeholder="Paste a code"
      aria-label="A friend's build code"
      spellcheck={false}
      help={code_error || undefined}
      oninput={() => (code_error = "")}
    />
    <Button type="submit">Load</Button>
  </form>
</div>

<div class="garage-group">
  <SectionHead eyebrow="Presets" />
  <ol class="garage-builds">
    {#each presets as preset (preset.index)}
      <li class="garage-build">
        {@render entry(preset.name, preset.blurb, preset.code, preset.rating, preset.facts, (event) => keep_place(event, () => garage.load_preset(preset.index)))}
      </li>
    {/each}
  </ol>
</div>

<div class="garage-group">
  <SectionHead eyebrow={saved.length ? "My builds" : "No builds saved yet"} />
  <ol class="garage-builds">
    {#each saved as build (build.name)}
      <li class="garage-build">
        {#if build.name === garage.renaming}
          <form class="garage-form garage-rename" onsubmit={(event) => finish_rename(event, build.name)}>
            <TextField
              bind:value={rename}
              name="rename"
              maxlength={BUILD_NAME_LENGTH}
              aria-label={`New name for ${build.name}`}
              spellcheck={false}
              autofocus
              help={rename_error || undefined}
              oninput={() => (rename_error = "")}
            />
            <Button type="submit">Save</Button>
            <Button variant="quiet" onclick={(event) => keep_place(event, () => (garage.renaming = null))}>Cancel</Button>
          </form>
        {:else}
          {@render entry(build.name, build.sub, build.code, build.rating, build.facts, (event) => keep_place(event, () => garage.load(build.code)))}
          <div class="garage-build-tools">
            <IconButton icon="icon-edit" label={`Rename ${build.name}`} data-rename onclick={() => start_rename(build.name)} />
            {#if armed === build.name}
              <Button variant="danger" data-armed aria-label={`Delete ${build.name}: press again to confirm`} onblur={disarm} onclick={(event) => keep_place(event, () => garage.delete_build(build.name))}>
                Sure?
              </Button>
            {:else}
              <IconButton icon="icon-close" label={`Delete ${build.name}`} onclick={() => ask_delete(build.name)} />
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  .garage-group {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }

  .garage-form {
    display: flex;
    align-items: start;
    gap: var(--space-2);
    min-width: 0;
  }

  .garage-form > :global(.ui-field) {
    flex: 1;
  }

  .garage-code {
    flex: 1;
    min-width: 0;
    align-self: center;
    overflow: hidden;
    color: var(--set-dim);
    font-family: var(--font-mono);
    font-size: var(--text-md);
    text-overflow: ellipsis;
    white-space: nowrap;
    user-select: text;
  }

  .garage-builds {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .garage-build {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--space-2);
  }

  .garage-build:has(.garage-rename) {
    grid-template-columns: minmax(0, 1fr);
  }

  .garage-build-tools {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .garage-rename {
    flex-wrap: wrap;
  }
</style>
