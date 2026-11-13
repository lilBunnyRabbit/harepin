<script lang="ts">
  import { FREE_CAP } from "../../runs/runs-store";
  import { daily, new_seed, random, season_days_left } from "../../runs/runs";
  import Button from "../ui/Button.svelte";
  import Card from "../ui/Card.svelte";
  import ClassBadge from "../ui/ClassBadge.svelte";
  import Progress from "../ui/Progress.svelte";
  import Row from "../ui/Row.svelte";
  import RowList from "../ui/RowList.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import Tabs from "../ui/Tabs.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import RunBuilder from "./RunBuilder.svelte";
  import { car_text, pick_text, star_text } from "./run-text";

  let { menu, live }: PageProps = $props();

  type View = "today" | "build";
  const VIEWS: { id: View; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "build", label: "Build an event" },
  ];

  const host = $derived(menu.host);
  const runs = $derived(host.runs);
  const today = $derived(live.live(() => runs.today));
  const pick = $derived(daily(today));
  const got = $derived(live.live(() => runs.daily(today)));
  const season = $derived(live.live(() => runs.stars));
  const free = $derived(FREE_CAP - live.live(() => runs.free_left));
  const days = $derived(season_days_left(today));
  const stars = $derived(star_text(got));

  let view = $state<View>("today");
</script>

<div class="runs">
  <div class="views"><Tabs items={VIEWS} bind:value={view} label="Runs" /></div>

  {#if view === "today"}
    <div class="cols">
      <Card list label="Today's runs">
        <div class="head"><SectionHead title="Today" count={today} /></div>
        <RowList divided label="Today's runs">
          <Row label={`Daily · ${pick_text(pick)}`} help="The same event for everyone today, on a map picked by the date">
            {#snippet control()}
              <span class="end">
                <span class="facts">
                  {#if "cap" in pick.car}<ClassBadge cap={pick.car.cap} />{:else}<span class="preset">{car_text(pick.car)}</span>{/if}
                  <span class="star-row" aria-label={`${got} of 3 stars today`}>{stars.on}<i>{stars.off}</i></span>
                </span>
                <Button size="sm" variant="primary" aria-label="Go: today's daily" onclick={() => host.start_run(pick.id)}>Go</Button>
              </span>
            {/snippet}
          </Row>
          <Row label="Endless" help="A new event on a new map every run: any mode, any world">
            {#snippet control()}
              <Button size="sm" aria-label="Go: endless run" onclick={() => host.start_run(random(new_seed()).id)}>Go</Button>
            {/snippet}
          </Row>
        </RowList>
      </Card>

      <Card label="Season">
        <div class="season">
          <SectionHead title="Season" count={`${season} ★`} />
          <p class="dim">Ends in {days} {days === 1 ? "day" : "days"}. Runs earn season stars, never career stars.</p>
          <div class="cap">
            <span class="cap-label"><span>Endless and built runs today</span><b>{free} / {FREE_CAP} ★</b></span>
            <Progress value={free} max={FREE_CAP} label={`${free} of ${FREE_CAP} season stars from endless and built runs today`} />
          </div>
          <p class="dim">The daily's stars count on top of the cap.</p>
        </div>
      </Card>
    </div>
  {:else}
    <RunBuilder {menu} />
  {/if}
</div>

<style>
  .runs {
    display: grid;
    align-content: start;
    gap: var(--space-5);
  }

  .views {
    display: flex;
    min-width: 0;
  }

  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    align-items: start;
    gap: var(--space-5);
  }

  .head {
    padding: var(--space-4) var(--space-4) var(--space-2);
  }

  .season {
    display: grid;
    gap: var(--space-4);
  }

  .cap {
    display: grid;
    gap: var(--space-2);
  }

  .cap-label {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    color: var(--set-dim);
    font-size: var(--text-sm);
  }

  .cap-label b {
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
  }

  .dim {
    margin: 0;
    color: var(--set-dim);
    text-wrap: pretty;
  }

  .end,
  .facts {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .preset {
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  .star-row {
    color: var(--accent);
    letter-spacing: 0.15em;
  }

  .star-row i {
    color: var(--line-strong);
    font-style: normal;
  }

  @media (max-width: 900px) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 600px) {
    .facts {
      flex-direction: column;
      align-items: end;
      gap: var(--space-1);
    }
  }
</style>
