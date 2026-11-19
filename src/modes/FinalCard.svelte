<script lang="ts">
  import { CARS } from "../car/cars";
  import { SERIES_PAGE, ordinal, place_of, player_of, season_done, standings, trophy_of } from "../career/series";
  import { season_title } from "../menu/series-view";
  import { series_front, series_open } from "../career/series-store";
  import { credits_text } from "../career/wallet";
  import CarStill from "../menu/CarStill.svelte";
  import { bare_enter } from "../menu/drive-picks";
  import MenuFrame from "../menu/MenuFrame.svelte";
  import Card from "../menu/ui/Card.svelte";
  import PrimaryAction from "../menu/ui/PrimaryAction.svelte";
  import type { PageProps } from "../menu/ui/svelte-page.svelte";
  import { FINAL_PAGE } from "./final";

  interface Props extends PageProps {
    /** The season just finished, by id; null on a review shot, which shows the last one done. */
    finished: () => string | null;
  }

  let { menu, live, shown, finished }: Props = $props();

  const list = $derived(menu.host.series);
  const at = $derived(
    live.live(() => {
      const id = finished();
      const just = list.findIndex((one) => one.base.id === id);
      if (just >= 0) return just;
      const done = list.findLastIndex((one) => one.ready && season_done(one.season, one.progress));
      return done >= 0 ? done : series_front(list);
    }),
  );
  const season = $derived(live.live(() => list[at]?.season ?? null));
  const progress = $derived(live.live(() => list[at]?.progress ?? null));
  const table = $derived(season && progress ? standings(season, progress) : []);
  const place = $derived(table.findIndex((row) => row.you) + 1);
  const wins = $derived(season && progress ? season.events.filter((event) => progress.results[event.id] && place_of(progress.results[event.id], player_of(season)) === 1).length : 0);
  const trophy = $derived(progress ? trophy_of(progress) : null);
  const after = $derived(live.live(() => (series_open(list)[at + 1] ? (list[at + 1]?.base ?? null) : null)));

  const go = () => menu.show(SERIES_PAGE);

  function key(event: KeyboardEvent) {
    if (!shown || event.defaultPrevented || !bare_enter(event)) return;
    event.preventDefault();
    go();
  }
</script>

<svelte:window onkeydown={key} />

{#snippet primary()}
  <PrimaryAction onclick={go}>{after ? `Next series: ${after.name}` : "Back to Series"}</PrimaryAction>
{/snippet}

<MenuFrame {menu} id={FINAL_PAGE} floor {primary}>
  {#if season}
    <div class="final">
      <div class="final-side" data-stage-panel data-side="left">
        <Card label="Final standings">
          <b class="final-h3">Final standings</b>
          <ol class="final-table">
            {#each table as row, i (row.driver)}
              <li data-you={row.you || undefined}>
                <span class="final-pos">{i + 1}</span>
                <span class="final-who">{row.name}</span>
                <b>{row.points}</b>
              </li>
            {/each}
          </ol>
        </Card>
      </div>
      <div class="final-champ" data-stage-panel>
        <span class="final-eyebrow">Harepin Series · {season_title(season)}</span>
        <span class="final-display">{place === 1 ? "Champion" : `${ordinal(place)} place`}</span>
        <span class="final-sub">{wins} {wins === 1 ? "win" : "wins"} in {season.events.length} rounds</span>
      </div>
      <div class="final-side" data-stage-panel data-side="right">
        <Card label="Rewards">
          <b class="final-h3">Rewards</b>
          {#if season.reward.car}
            <div class="final-reward">
              <span class="final-pic"><CarStill car={season.reward.car} /></span>
              <div class="final-text"><b>{CARS[season.reward.car].name}</b><span>Yours to keep</span></div>
            </div>
          {/if}
          {#if trophy}
            <div class="final-reward">
              <span class="final-pic final-icon" aria-hidden="true">★</span>
              <div class="final-text"><b>{trophy}</b><span>Trophy</span></div>
            </div>
          {/if}
          {#if season.reward.credits > 0}
            <div class="final-reward">
              <span class="final-pic final-icon" aria-hidden="true">★</span>
              <div class="final-text"><b class="final-mono">+{credits_text(season.reward.credits)}</b><span>Credits</span></div>
            </div>
          {/if}
        </Card>
      </div>
    </div>
  {/if}
</MenuFrame>

<style>
  .final {
    --final-side: calc(var(--row-h) * 8);
    display: grid;
    grid-template-columns: var(--final-side) minmax(0, 1fr) var(--final-side);
    align-items: start;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
    /* Only the cards take the pointer: a drag anywhere else turns the car. */
    pointer-events: none;
  }

  .final-side {
    display: grid;
    min-width: 0;
  }

  .final-side > :global(*) {
    pointer-events: auto;
  }

  .final-side[data-side="left"] {
    --stage-side: left;
  }

  .final-side[data-side="right"] {
    --stage-side: right;
  }

  /* The place sits straight on the live sky, which can be as light as the dim text. */
  .final-champ {
    --stage-side: top;
    display: grid;
    justify-items: center;
    gap: var(--gap-sm);
    min-width: 0;
    padding-top: var(--pad);
    text-align: center;
    text-shadow:
      0 0 2px var(--background-darkest),
      0 1px 12px var(--background-darkest);
  }

  .final-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .final-display {
    color: var(--cottontail);
    font-size: var(--display-2);
    font-weight: 800;
    line-height: 1;
  }

  .final-sub {
    color: var(--dim);
    font-size: var(--type-h3);
    font-weight: 700;
  }

  .final-h3 {
    font-size: var(--type-h3);
    font-weight: 800;
    line-height: 1.15;
  }

  .final-table {
    display: grid;
    gap: var(--gap-xs);
    margin: 0;
    padding: 0;
    list-style: none;
    font-variant-numeric: tabular-nums;
  }

  .final-table li {
    display: grid;
    grid-template-columns: 1.6em minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--gap-sm);
    min-height: var(--row-h);
    padding: 0 var(--gap-md);
    border-radius: var(--radius-md);
    white-space: nowrap;
  }

  .final-table li[data-you] {
    background: var(--row-on);
    color: var(--primary);
  }

  .final-pos {
    color: var(--dim);
  }

  .final-who {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .final-table b,
  .final-mono {
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .final-reward {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    min-width: 0;
  }

  .final-pic {
    display: grid;
    flex: none;
    place-items: center;
    width: calc(var(--top-h) * 1.5);
    height: var(--top-h);
    overflow: hidden;
    border-radius: var(--radius-md);
    background: var(--row);
  }

  .final-pic > :global(img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .final-icon {
    color: var(--warning);
    font-size: var(--type-h2);
    line-height: 1;
  }

  .final-text {
    display: grid;
    min-width: 0;
    line-height: 1.25;
  }

  .final-text span {
    color: var(--dim);
    font-size: var(--type-small);
  }

  @media (max-height: 500px) {
    .final-champ {
      padding-top: 0;
    }

    .final-table li {
      min-height: 0;
    }
  }
</style>
