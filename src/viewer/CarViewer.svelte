<script lang="ts">
  import { build_spec, parse_build } from "../car/build";
  import { CARS, type CarId } from "../car/cars";
  import { paint_lab } from "../car/paint";
  import Button from "../menu/ui/Button.svelte";
  import IconButton from "../menu/ui/IconButton.svelte";
  import Segmented from "../menu/ui/Segmented.svelte";
  import Select from "../menu/ui/Select.svelte";
  import Slider from "../menu/ui/Slider.svelte";
  import { rgba } from "../theme/palette";
  import { SNAPS, type Snap } from "./orbit";
  import { Light } from "./view-state";
  import { CAR_IDS, PAINTS, type Viewer } from "./viewer.svelte";

  interface Props {
    viewer: Viewer;
  }

  let { viewer }: Props = $props();

  const DEG = 180 / Math.PI;
  const snaps = Object.entries(SNAPS) as [Snap, (typeof SNAPS)[Snap]][];
  const view = $derived(viewer.view);
  const car_options = $derived(CAR_IDS.map((id) => ({ value: id, label: `${CARS[id].name}${viewer.count(id) ? ` · ${viewer.count(id)}` : ""}` })));
  const preset_options = $derived(
    viewer.presets.map((p) => {
      const n = viewer.notes[`${view.car}/${p.id}`]?.length ?? 0;
      return { value: p.id, label: `${p.label}${n ? ` · ${n}` : ""}` };
    }),
  );
  const lock = $derived.by(() => {
    const build = parse_build(view.code);
    return build ? build_spec(build).lock : 0;
  });
  const list = $derived(viewer.list);
  const numbers = $derived(viewer.numbers);
  const preset_label = $derived(viewer.presets.find((p) => p.id === view.preset)?.label ?? view.preset);
  const light_options = [
    { value: Light.DAY, label: "Day" },
    { value: Light.DUSK, label: "Dusk" },
  ];

  let host: HTMLDivElement;

  $effect(() => {
    host.prepend(viewer.stage.canvas);
    const observer = new ResizeObserver(([entry]) => viewer.resized(entry.contentRect.width, entry.contentRect.height));
    observer.observe(host);
    viewer.start();
    return () => {
      observer.disconnect();
      viewer.stop();
    };
  });

  const cam_line = (cam: { yaw: number; pitch: number; dist: number }) => `${Math.round(cam.yaw)}° · ${Math.round(cam.pitch)}° up · ${cam.dist.toFixed(1)} m`;
</script>

<div class="cars-app" class:cars-shot={viewer.shot} class:cars-closed={!viewer.panel}>
  <div class="cars-stage" bind:this={host} class:cars-pinning={viewer.pinning}>
    {#if !viewer.shot}
      <div class="cars-bar">
        <div class="cars-pick">
          <Select label="Car" options={car_options} value={view.car} onchange={(id: CarId) => viewer.pick_car(id)} />
          <Select label="Build" options={preset_options} value={view.preset} onchange={(id: string) => viewer.pick_preset(id)} />
        </div>
        <div class="cars-acts">
          <IconButton icon="icon-recenter" label="Reset view" title="Reset view" onclick={() => viewer.reset()} />
          <Button size="sm" variant={viewer.auto ? "primary" : "secondary"} aria-pressed={viewer.auto} onclick={() => (viewer.auto = !viewer.auto)}>Spin</Button>
          <Button size="sm" variant={viewer.pinning ? "primary" : "secondary"} icon="icon-edit" aria-pressed={viewer.pinning} onclick={() => (viewer.pinning ? viewer.cancel_pin() : (viewer.pinning = true))}>Pin</Button>
          <IconButton icon={viewer.panel ? "icon-close" : "icon-chat"} label={viewer.panel ? "Hide panel" : "Show notes"} title={viewer.panel ? "Hide panel" : "Show notes"} onclick={() => (viewer.panel = !viewer.panel)} />
        </div>
      </div>
      {#if viewer.pinning}
        <p class="cars-hint" role="status">Tap the car where the pin goes</p>
      {/if}
      <div class="cars-tools" role="toolbar" aria-label="Views">
        {#each snaps as [id, snap] (id)}
          <Button size="sm" variant="quiet" onclick={() => viewer.snap(id)}>{snap.label}</Button>
        {/each}
      </div>
    {/if}
  </div>

  {#if !viewer.shot && viewer.panel}
    <aside class="cars-panel" aria-label="Car and notes">
      <section class="cars-group">
        <h2>Look</h2>
        <span class="cars-field">Paint</span>
        <div class="cars-paints" role="radiogroup" aria-label="Paint">
          {#each PAINTS as paint (paint)}
            <button type="button" role="radio" class="cars-paint" aria-checked={viewer.paint === paint} aria-label={`Paint ${paint}`} style:background={rgba(paint_lab(paint))} onclick={() => viewer.pick_paint(paint)}></button>
          {/each}
        </div>
        <span class="cars-field">Steering</span>
        <Slider label="Steer" min={-1} max={1} step={0.05} value={view.steer} format={(v) => (v === 0 ? "0°" : `${Math.round(Math.abs(v) * lock * DEG)}° ${v > 0 ? "right" : "left"}`)} onchange={(v) => viewer.set_steer(v)} />
        <Segmented label="Light" options={light_options} value={view.light} onchange={(light) => viewer.relight(light)} />
      </section>

      <section class="cars-group cars-notes">
        <h2>Notes <span>{CARS[view.car].name} · {preset_label}</span></h2>
        {#if list.length}
          <ol class="cars-list">
            {#each list as note, i (i)}
              <li class="cars-note" class:picked={viewer.picked === i}>
                <button type="button" class="cars-note-go" onclick={() => viewer.go(i)} title="Fly to the view this was written at">
                  <span class="cars-badge" class:pin={numbers[i] !== null}>{numbers[i] ?? "·"}</span>
                  <span class="cars-note-text">{note.text || "(no text)"}</span>
                  <span class="cars-note-cam">{cam_line(note.view.cam)} · {note.view.light}</span>
                </button>
                {#if viewer.picked === i}
                  <textarea aria-label="Edit note" rows="3" value={note.text} oninput={(e) => viewer.edit(i, e.currentTarget.value)}></textarea>
                  <div class="cars-row">
                    <Button size="sm" variant="danger" onclick={() => viewer.remove(i)}>Delete</Button>
                  </div>
                {/if}
              </li>
            {/each}
          </ol>
        {:else}
          <p class="cars-empty">No notes on this build yet. Write one below, or press Pin and tap the car.</p>
        {/if}

        <div class="cars-compose">
          <label class="cars-label" for="cars-draft">{viewer.pending ? `Pin ${viewer.next_pin}` : "New note"} <span>keeps this exact view</span></label>
          <textarea id="cars-draft" rows="3" placeholder={viewer.pending ? "What is off at this spot?" : "What is off on this build?"} bind:value={viewer.draft}></textarea>
          <div class="cars-row">
            {#if viewer.pending}<Button size="sm" variant="quiet" onclick={() => viewer.cancel_pin()}>Drop pin</Button>{/if}
            <Button size="sm" variant="primary" disabled={!viewer.draft.trim() && !viewer.pending} onclick={() => viewer.add()}>Save note</Button>
          </div>
        </div>
      </section>

      <section class="cars-group">
        <div class="cars-row">
          <Button size="sm" icon="icon-share" onclick={() => viewer.copy(view.car)}>{viewer.copied === view.car ? "Copied" : `Copy ${CARS[view.car].name}`}</Button>
          <Button size="sm" icon="icon-share" onclick={() => viewer.copy(null)}>{viewer.copied === "all" ? "Copied" : "Copy all"}</Button>
        </div>
        {#if viewer.refused !== null}
          <label class="cars-refused">
            <span>The browser refused the clipboard: select this and copy it.</span>
            <textarea readonly rows="6" onfocus={(e) => e.currentTarget.select()}>{viewer.refused}</textarea>
          </label>
        {/if}
      </section>
    </aside>
  {/if}
</div>

<style>
  :global(body:has(.cars-app) > :not(.cars-root)) {
    display: none !important;
  }

  :global(html:has(.cars-app)),
  :global(body:has(.cars-app)) {
    overflow: hidden;
    background: var(--background);
  }

  .cars-app {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    user-select: none;
    color: var(--foreground);
    font-size: var(--text-md);
  }

  .cars-app.cars-closed,
  .cars-app.cars-shot {
    grid-template-columns: minmax(0, 1fr);
  }

  .cars-stage {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .cars-stage :global(.cars-canvas) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    cursor: grab;
  }

  .cars-pinning :global(.cars-canvas) {
    cursor: crosshair;
  }

  .cars-bar {
    position: absolute;
    top: var(--inset-top);
    left: var(--inset-left);
    right: var(--inset);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2);
    pointer-events: none;
  }

  .cars-closed .cars-bar {
    right: var(--inset-right);
  }

  .cars-pick {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    min-width: 0;
  }

  .cars-bar > :global(*) {
    pointer-events: auto;
  }

  .cars-hint {
    position: absolute;
    bottom: calc(var(--inset-bottom) + var(--control-h) + var(--space-4));
    left: 50%;
    translate: -50% 0;
    margin: 0;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    background: var(--surface);
    pointer-events: none;
    white-space: nowrap;
  }

  .cars-tools {
    position: absolute;
    left: 50%;
    bottom: var(--inset-bottom);
    translate: -50% 0;
    display: flex;
    gap: var(--space-1);
    max-width: calc(100% - 2 * var(--inset));
    padding: var(--space-1);
    overflow-x: auto;
    scrollbar-width: none;
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .cars-acts {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-1);
  }

  .cars-panel {
    display: grid;
    align-content: start;
    gap: var(--space-6);
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: none;
    padding: var(--inset-top) var(--inset-right) var(--inset-bottom) var(--space-5);
    border-left: 1px solid var(--line);
    background: var(--panel);
  }

  .cars-group {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }

  h2 {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }

  h2 span,
  .cars-label span {
    color: var(--dim);
    font-size: var(--text-sm);
    font-weight: 400;
  }

  .cars-field {
    margin-bottom: calc(var(--space-2) - var(--space-4));
    color: var(--dim);
    font-size: var(--text-sm);
  }

  .cars-paints {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .cars-paint {
    width: var(--control-h-sm);
    height: var(--control-h-sm);
    padding: 0;
    border: 2px solid var(--line-strong);
    border-radius: var(--radius-full);
    cursor: pointer;
  }

  .cars-paint[aria-checked="true"] {
    outline: 2px solid var(--foreground);
    outline-offset: 2px;
  }

  .cars-list {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .cars-note {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel-well);
  }

  .cars-note.picked {
    border-color: var(--accent);
  }

  .cars-note-go {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-0) var(--space-3);
    align-items: center;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .cars-badge {
    grid-row: span 2;
    display: grid;
    place-items: center;
    width: var(--control-h-sm);
    height: var(--control-h-sm);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
    color: var(--dim);
    font-weight: 700;
  }

  .cars-badge.pin {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
  }

  .picked .cars-badge.pin {
    border-color: var(--cottontail);
    background: var(--cottontail);
    color: var(--on-cottontail);
  }

  .cars-note-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cars-note-cam,
  .cars-empty {
    color: var(--dim);
    font-size: var(--text-sm);
  }

  .cars-empty {
    margin: 0;
    text-wrap: pretty;
  }

  .cars-compose {
    display: grid;
    gap: var(--space-2);
  }

  .cars-label {
    font-weight: 600;
  }

  .cars-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  textarea {
    width: 100%;
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--panel-well);
    color: var(--foreground);
    font: inherit;
    resize: vertical;
  }

  textarea:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 1px;
  }

  .cars-refused {
    display: grid;
    gap: var(--space-2);
    color: var(--dim);
    font-size: var(--text-sm);
  }

  .cars-refused textarea {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  @media (max-height: 500px) {
    .cars-app {
      grid-template-columns: minmax(0, 1fr) 280px;
    }

    .cars-panel {
      gap: var(--space-4);
    }
  }

  @media (max-width: 600px) {
    .cars-app {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) minmax(0, 45%);
    }

    .cars-app.cars-closed,
    .cars-app.cars-shot {
      grid-template-rows: minmax(0, 1fr);
    }

    .cars-panel {
      padding: var(--space-4) var(--inset-right) var(--inset-bottom) var(--inset-left);
      border-left: 0;
      border-top: 1px solid var(--line);
    }
  }
</style>
