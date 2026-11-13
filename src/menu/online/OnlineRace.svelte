<script lang="ts">
  import { NOT_THIS_CAR } from "../../net/lobby";
  import { LAPS, type Laps } from "../prefs";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import Tile from "../ui/Tile.svelte";

  const LAP_OPTIONS = LAPS.map((count) => ({ value: count, label: String(count) }));

  let { menu, live }: Omit<PageProps, "shown"> = $props();

  const routes = $derived(menu.host.race_routes);
  let route_id = $state("circuit");

  const route = $derived(routes.find((r) => r.id === route_id) ?? routes[0]);
  const loop = $derived(route?.closed !== false);
  const laps = $derived<Laps>(loop ? live.prefs.laps : 1);
  const left_out = $derived(live.live(() => menu.host.race_left_out(route?.id ?? "circuit")));
  const busy = $derived(live.live(() => menu.host.race_busy()));
  const ready = $derived(live.live(() => menu.host.race_ready()));
  const ready_line = $derived(live.live(ready_text));
  const record = $derived(live.live(() => menu.host.lobby_record()));
  const note = $derived(left_out ? NOT_THIS_CAR : loop ? "Everyone in the room starts together." : "A to B routes are one run, start to finish.");

  // Read from the menu, not `live`: a handler can run between a setting change and the next pull.
  function picked() {
    return { laps: route?.closed === false ? 1 : menu.state().laps, route: route?.id ?? "circuit" };
  }

  function repick() {
    const { laps, route } = picked();
    menu.host.repick_ready(laps, route);
  }

  function pick_route(id: string) {
    route_id = id;
    repick();
    menu.refresh();
  }

  function pick_laps(count: Laps) {
    live.set("laps", count);
    repick();
  }

  function toggle_ready() {
    const { laps, route } = picked();
    menu.host.toggle_ready(laps, route);
    menu.refresh();
  }

  function toggle_race() {
    const { laps, route } = picked();
    menu.host.toggle_race(laps, route);
    menu.refresh();
  }

  function ready_text(): string {
    const { names, waiting, total, next, electing, left_out } = menu.host.ready_status();
    if (total === 1) return electing ? "Looking for players in the room…" : "Ready starts the race when you're alone.";
    const who = names.length ? ` · ${names.join(", ")}` : "";
    const next_route = next && routes.find((r) => r.id === next.route);
    const runs = next_route
      ? ` · next: ${next_route.name}${next_route.closed ? `, ${next.laps} lap${next.laps === 1 ? "" : "s"}` : ""}${left_out ? ", not raced in your car: you sit it out" : ""}`
      : "";
    return `${names.length}/${total} ready${who} · waiting for ${waiting.join(", ")}${runs}.`;
  }
</script>

<Card class="online-race">
  <SectionHead title="Lobby race" />
  {#if routes.length}
    <div class="race-routes" role="group" aria-label="Route">
      {#each routes as choice (choice.id)}
        <Tile
          size="sm"
          title={choice.name}
          meta={`${(choice.length / 1000).toFixed(1)} km · ${choice.closed ? "loop" : "A to B"}`}
          selected={choice.id === route?.id}
          onclick={() => pick_route(choice.id)}
        />
      {/each}
    </div>
    <div class="race-laps">
      <span>Laps</span>
      <Segmented options={LAP_OPTIONS} value={laps} label="Laps" disabled={!loop} onchange={pick_laps} />
    </div>
    <small class="race-dim">{note}</small>
    <div class="race-actions">
      {#if !busy}
        <Button variant="primary" size="lg" aria-pressed={ready} disabled={!ready && left_out} onclick={toggle_ready}>{ready ? "Cancel ready" : "Ready"}</Button>
      {/if}
      <Button size="lg" disabled={!busy && left_out} onclick={toggle_race}>{busy ? "Leave race" : "Start race"}</Button>
    </div>
    {#if !busy}<small class="race-dim">{ready_line}</small>{/if}
    {#if record}<small class="race-dim">{record}</small>{/if}
  {:else}
    <small class="race-dim">No races on this map: it is all free roam.</small>
  {/if}
</Card>

<style>
  .race-routes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
    gap: var(--space-2);
  }

  .race-laps {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding-top: var(--space-2);
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .race-laps > :global(.ui-segmented) {
    flex: 0 1 240px;
  }

  .race-dim {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    text-wrap: pretty;
  }

  .race-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding-top: var(--space-2);
  }
</style>
