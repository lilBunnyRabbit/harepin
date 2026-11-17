<script lang="ts">
  import { parse_build } from "../../car/build";
  import { flag } from "../../net/country";
  import type { CarPicker } from "../car-pick.svelte";
  import CarStill from "../CarStill.svelte";
  import { bare_enter, link_key } from "../drive-picks";
  import MenuFrame from "../MenuFrame.svelte";
  import { change_own_car } from "../own-car";
  import { LAPS, type Laps } from "../prefs";
  import Card from "../ui/Card.svelte";
  import Icon from "../ui/Icon.svelte";
  import KeyLink from "../ui/KeyLink.svelte";
  import PrimaryAction from "../ui/PrimaryAction.svelte";
  import Segmented from "../ui/Segmented.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import { initial, meet_note } from "./meet";
  import { MEET_PAGE, room_name } from "./rooms";

  const LEAVE_HOLD_MS = 800;

  interface Props extends PageProps {
    picker: CarPicker;
  }

  let { menu, live, shown, picker }: Props = $props();

  const host = $derived(menu.host);
  const routes = $derived(host.race_routes);
  let route_id = $state("circuit");
  let changing = $state(false);

  const route = $derived(routes.find((one) => one.id === route_id) ?? routes[0]);
  const loop = $derived(route?.closed !== false);
  const laps = $derived<Laps>(loop ? live.prefs.laps : 1);
  // An A to B route is one run: 1 stays picked and the other counts wait for a loop.
  const lap_options = $derived(LAPS.map((count) => ({ value: count, label: String(count), disabled: !loop && count !== 1 })));
  const left_out = $derived(live.live(() => host.race_left_out(route?.id ?? "circuit")));
  const busy = $derived(live.live(() => host.race_busy()));
  const ready = $derived(live.live(() => host.race_ready()));
  const status = $derived(live.live(() => host.ready_status()));
  const record = $derived(live.live(() => host.lobby_record()));
  const alone = $derived(status.total <= 1);
  const cards = $derived(live.live(() => host.meet_drivers()).map((one) => ({ ...one, build: parse_build(one.car) })));
  // What an all-ready start runs is the leader's pick; until the leader readies, this player's own shows.
  const called = $derived(status.next ? { route: routes.find((one) => one.id === status.next?.route) ?? route, laps: status.next.laps } : { route, laps });
  const called_text = $derived(called.route ? `${called.route.name} · ${called.route.closed ? `${called.laps} ${called.laps === 1 ? "lap" : "laps"}` : "A to B"}` : "");
  const verb = $derived(busy ? "Hold to leave race" : ready ? "Cancel ready" : alone ? `Race ${route?.name ?? ""}` : "Ready");

  export function back(): boolean {
    if (!changing) return false;
    changing = false;
    return true;
  }

  $effect(() => {
    if (!shown) changing = false;
  });

  // Read from the menu, not `live`: a handler can run between a setting change and the next pull.
  function picked() {
    return { laps: route?.closed === false ? 1 : menu.state().laps, route: route?.id ?? "circuit" };
  }

  function repick() {
    const { laps, route } = picked();
    host.repick_ready(laps, route);
  }

  function pick_route(id: string) {
    route_id = id;
    repick();
    menu.refresh();
  }

  // On an A to B route the only open option is 1: it stands for the run, not for the laps a loop remembers.
  function pick_laps(count: Laps) {
    if (loop) live.set("laps", count);
    repick();
  }

  function toggle_ready() {
    if (!ready && left_out) return;
    const { laps, route } = picked();
    host.toggle_ready(laps, route);
    menu.refresh();
  }

  function toggle_race() {
    const { laps, route } = picked();
    host.toggle_race(laps, route);
    menu.refresh();
  }

  const change_car = () => void change_own_car(menu, picker, "Race meet");

  function key(event: KeyboardEvent) {
    if (!shown || !routes.length) return;
    if (bare_enter(event)) {
      event.preventDefault();
      // Leaving a running race takes the hold on the button, never a stray Enter.
      if (changing) changing = false;
      else if (!busy) toggle_ready();
      return;
    }
    if (changing || busy) return;
    const link = link_key(event);
    if (link === "r") changing = true;
    else if (link === "c") change_car();
    else if (link === "s" && !alone && !left_out) toggle_race();
  }
</script>

<svelte:window onkeydown={key} />

{#if changing && route}
  <MenuFrame {menu} id={MEET_PAGE} eyebrow="Race meet" title="Route" season={false} veil={0.55} back_to="Race meet" note={left_out ? "This car can't race here" : loop ? "Everyone in the room starts together." : "A to B routes are one run, start to finish."}>
    <div class="meet-setup">
      <Card label="Route">
        <div class="meet-routes" role="group" aria-label="Route">
          {#each routes as choice (choice.id)}
            <Card pad="sm" flat selected={choice.id === route.id} focused={choice.id === route.id} onclick={() => pick_route(choice.id)}>
              <b>{choice.name}</b>
              <span class="meet-dim">{(choice.length / 1000).toFixed(1)} km · {choice.closed ? "loop" : "A to B"}</span>
            </Card>
          {/each}
        </div>
        <div class="meet-laps">
          <b>Laps</b>
          <span class="meet-laps-pick"><Segmented options={lap_options} value={laps} label="Laps" onchange={pick_laps} /></span>
        </div>
        {#if record}<span class="meet-dim">{record}</span>{/if}
      </Card>
    </div>
    {#snippet primary()}
      <PrimaryAction tone="online" onclick={() => (changing = false)}>Use {route.name}</PrimaryAction>
    {/snippet}
  </MenuFrame>
{:else}
  <MenuFrame {menu} id={MEET_PAGE} eyebrow="Online" title="Race meet" season={false} floor note={routes.length ? meet_note(status, busy, left_out) : ""}>
    <div class="meet">
      {#if called.route}
        <Card pad="sm" class="meet-top" label="Race meet">
          <span class="meet-top-text">
            <span class="meet-eyebrow">Room {room_name(host)}{status.next ? " · the leader's pick" : ""}</span>
            <b class="meet-route">{called_text}</b>
          </span>
          <span class="meet-count" role="img" aria-label={`${status.names.length} of ${status.total} ready`}>
            <span class="meet-big">{status.names.length}/{status.total}</span>
            <span class="meet-eyebrow">ready</span>
          </span>
        </Card>
        <div class="meet-drivers">
          {#each cards as one (one.id)}
            <Card pad="none" class="meet-driver" focused={one.you} label={one.name}>
              <span class="meet-face" aria-hidden="true">
                {#if one.build}<CarStill car={one.build.car} build={one.build} />{:else}{initial(one.name)}{/if}
              </span>
              <span class="meet-cap">
                <span class="meet-state" data-ready={one.ready ? "" : undefined}>{#if one.ready}<Icon name="icon-check" />{/if}{one.ready ? "Ready" : "Not ready"}</span>
                <b class="meet-name">{#if one.country}<span class="meet-flag">{flag(one.country)}</span>{/if}{one.name}{one.you ? " · you" : ""}</b>
              </span>
            </Card>
          {/each}
          <div class="meet-open">
            <Icon name="icon-car" />
            <span>Open slot<br />an invite fills it</span>
          </div>
        </div>
      {:else}
        <Card class="meet-none" label="Race meet">
          <b>No races on this map</b>
          <span class="meet-dim">It is all free roam. Maps on Home lists the ones with routes.</span>
        </Card>
      {/if}
    </div>
    {#snippet links()}
      {#if route && !busy}
        <KeyLink keys={{ key: "C" }} onclick={change_car}>Change car</KeyLink>
        <KeyLink keys={{ key: "R" }} onclick={() => (changing = true)}>Route</KeyLink>
        {#if !alone && !left_out}<KeyLink keys={{ key: "S" }} onclick={toggle_race}>Start without waiting</KeyLink>{/if}
      {/if}
    {/snippet}
    {#snippet primary()}
      {#if route}
        {#if busy}
          <PrimaryAction tone="online" hold={LEAVE_HOLD_MS} onheld={toggle_race}>{verb}</PrimaryAction>
        {:else}
          <PrimaryAction tone="online" disabled={!ready && left_out} onclick={toggle_ready}>{verb}</PrimaryAction>
        {/if}
      {/if}
    {/snippet}
  </MenuFrame>
{/if}

<style>
  .meet {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    justify-items: center;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .meet > :global(.meet-top) {
    flex-direction: row;
    align-items: center;
    gap: var(--pad);
    max-width: 100%;
  }

  .meet-top-text {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .meet-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .meet-route {
    overflow: hidden;
    font-size: var(--type-h3);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meet-count {
    display: grid;
    justify-items: end;
    gap: var(--gap-xs);
  }

  .meet-big {
    color: var(--secondary);
    font-family: var(--font-mono);
    font-size: var(--type-h1);
    font-weight: 700;
    line-height: 1;
  }

  .meet-drivers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 210px));
    align-self: end;
    justify-content: center;
    gap: var(--gap);
    width: 100%;
    min-width: 0;
  }

  .meet-drivers > :global(.meet-driver) {
    gap: 0;
    overflow: hidden;
  }

  .meet-face {
    display: grid;
    place-items: center;
    aspect-ratio: 5 / 3;
    background: var(--row);
    color: var(--dim);
    font-size: var(--display-1);
    font-weight: 800;
    line-height: 1;
  }

  .meet-cap {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
    padding: var(--gap-md) var(--gap);
  }

  .meet-state {
    --icon-size: 1.1em;
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .meet-state[data-ready] {
    color: var(--success);
    font-weight: 700;
  }

  .meet-face > :global(.still) {
    width: 100%;
    height: 100%;
  }

  .meet-flag {
    margin-right: 0.4em;
  }

  .meet-name {
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meet-open {
    --icon-size: 1.6em;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--gap-sm);
    min-width: 0;
    padding: var(--gap);
    border: 1px dashed var(--line-strong);
    border-radius: var(--card-radius);
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
    text-align: center;
  }

  .meet-dim {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .meet > :global(.meet-none) {
    grid-row: 1 / -1;
    align-self: center;
  }

  .meet-setup {
    display: grid;
    grid-template-columns: minmax(0, 46rem);
    justify-content: center;
    align-content: start;
    height: 100%;
  }

  .meet-routes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
    gap: var(--gap-sm);
  }

  .meet-laps {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap);
  }

  .meet-laps-pick {
    display: grid;
    flex: 0 1 15rem;
  }

  @media (max-height: 500px) {
    .meet,
    .meet-setup {
      height: auto;
    }

    .meet-drivers {
      grid-template-columns: repeat(auto-fit, minmax(0, 132px));
    }
  }

  /* Portrait: two drivers a row, and a full room runs past the screen, so the body scrolls it. */
  @media (max-width: 700px) {
    .meet,
    .meet-setup {
      height: auto;
      min-height: 100%;
    }

    .meet-drivers {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
