<script lang="ts">
  import { BONUS_NAMES, BONUS_POINTS, KIND_BONUSES, KIND_NAMES, KIND_RULES, ordinal } from "../career/series";
  import SeriesBack from "./SeriesBack.svelte";
  import { event_art, event_score, lock_line, next_event, place_text, type SeriesView } from "./series-view";
  import Icon from "./ui/Icon.svelte";

  let { season, progress, states, table, done, onstart, onback, onreset }: SeriesView = $props();

  const next = $derived(next_event(season, progress, states));
  let picked = $state<number | null>(null);
  const shown = $derived(picked ?? Math.max(next, 0));
  const event = $derived(season.events[shown]);
  const status = $derived(states[shown]);
  const score = $derived(event_score(season, progress, event));
  const rank = $derived(table.findIndex((row) => row.you) + 1);
  const me = $derived(table.find((row) => row.you));
</script>

<div class="hb">
  {#key event.id}<img class="hb-art" src={event_art(event)} alt="" data-locked={status === "locked"} />{/key}
  <div class="hb-shade"></div>

  <div class="hb-top">
    <SeriesBack {onback} />
    <span class="hb-season">Season {season.id.slice(1)} · {season.name}</span>
    <span class="hb-me">{Object.keys(progress.results).length ? ordinal(rank) : "–"} · {me?.points ?? 0} pts</span>
  </div>

  <section class="hb-copy" aria-live="polite">
    <p class="hb-eyebrow">Event {shown + 1} of {season.events.length} · {event.final ? "Final" : KIND_NAMES[event.kind]}</p>
    <h2>{event.name}</h2>
    <p class="hb-rule">{KIND_RULES[event.kind]}</p>
    <ul class="hb-bonus">
      {#each KIND_BONUSES[event.kind] as bonus (bonus)}<li>{BONUS_NAMES[bonus]} <b>+{BONUS_POINTS[bonus]}</b></li>{/each}
    </ul>
    <div class="hb-cta">
      {#if status === "locked"}
        <span class="hb-lock"><Icon name="icon-lock" />{lock_line(event)}</span>
      {:else}
        <button type="button" class="hb-go" onclick={() => onstart(event.id)}><Icon name="icon-play" />{score ? "Race again" : "Race"}</button>
        {#if score}<span class="hb-best">Best <b data-podium={status === "podium"}>{place_text(score)}</b> · {score.points} pts</span>{/if}
      {/if}
    </div>
  </section>

  <aside class="hb-tower" aria-label="Standings">
    <h3>{done ? "Champion standings" : "Standings"}</h3>
    <ol>
      {#each table as row, i (row.driver)}
        <li data-you={row.you}>
          <span class="hb-pos">{i + 1}</span>
          <span class="hb-name">{row.name}{#if row.rival}<em>Rival</em>{/if}</span>
          <b>{row.points}</b>
        </li>
      {/each}
    </ol>
    <button type="button" class="hb-reset" onclick={onreset}>Start the series over</button>
  </aside>

  <nav class="hb-strip" aria-label="Events">
    {#each season.events as item, i (item.id)}
      {@const s = event_score(season, progress, item)}
      <button type="button" class="hb-thumb" aria-current={i === shown} data-state={states[i]} onclick={() => (picked = i)}>
        <img src={event_art(item)} alt="" loading="lazy" />
        <span class="hb-tn">{i + 1}</span>
        <span class="hb-tname">{item.name}</span>
        <span class="hb-tmark">
          {#if states[i] === "locked"}<Icon name="icon-lock" />{:else if s}{place_text(s)}{:else if i === next}Next{/if}
        </span>
      </button>
    {/each}
  </nav>
</div>

<style>
  .hb {
    position: relative;
    display: grid;
    grid-template: "top top" auto "copy tower" minmax(0, 1fr) "strip strip" auto / minmax(0, 1fr) 18rem;
    gap: var(--space-5) var(--space-8);
    height: 100%;
    padding: var(--space-6);
    overflow: hidden;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-well);
  }

  .hb-art {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: hb-in 300ms ease-out;
  }

  .hb-art[data-locked="true"] {
    filter: grayscale(1) brightness(0.45);
  }

  @keyframes hb-in {
    from {
      opacity: 0;
    }
  }

  .hb-shade {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to right, color-mix(in oklch, var(--background-darkest) 85%, transparent) 0%, transparent 55%),
      linear-gradient(to top, var(--background-darkest) 0%, transparent 35%);
  }

  .hb > :not(.hb-art, .hb-shade) {
    position: relative;
  }

  .hb-top {
    grid-area: top;
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .hb-season {
    margin-right: auto;
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hb-me {
    display: none;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    background: var(--surface);
    font-weight: 700;
  }

  .hb-copy {
    grid-area: copy;
    display: grid;
    align-content: end;
    gap: var(--space-3);
    max-width: 34rem;
  }

  .hb-eyebrow {
    margin: 0;
    color: var(--primary);
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: calc(var(--text-3xl) * 2.2);
    font-weight: 800;
    line-height: 1;
    text-wrap: balance;
  }

  .hb-rule {
    margin: 0;
    font-size: var(--text-xl);
    text-wrap: pretty;
  }

  .hb-bonus {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .hb-bonus li {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--surface);
    font-size: var(--text-sm);
  }

  .hb-bonus b {
    color: var(--success);
  }

  .hb-cta {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-top: var(--space-3);
  }

  .hb-go {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--control-h-lg);
    padding: 0 var(--space-8);
    border: 0;
    border-radius: var(--radius-full);
    background: var(--primary);
    color: var(--on-primary);
    font: inherit;
    font-size: var(--text-xl);
    font-weight: 800;
    cursor: pointer;
  }

  .hb-best,
  .hb-lock {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--set-dim);
    font-weight: 600;
  }

  .hb-best b {
    color: var(--foreground);
  }

  .hb-best b[data-podium="true"] {
    color: var(--success);
  }

  .hb-tower {
    grid-area: tower;
    align-self: start;
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  h3 {
    margin: 0 0 var(--space-1);
    color: var(--set-dim);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hb-tower ol {
    display: grid;
    gap: var(--space-0);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .hb-tower li {
    display: grid;
    grid-template-columns: 1.5em minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-variant-numeric: tabular-nums;
  }

  .hb-tower li[data-you="true"] {
    background: var(--primary);
    color: var(--on-primary);
  }

  .hb-pos {
    opacity: 0.7;
  }

  .hb-name {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    overflow: hidden;
    white-space: nowrap;
  }

  em {
    color: var(--warning);
    font-size: var(--text-2xs);
    font-style: normal;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hb-reset {
    justify-self: start;
    padding: 0;
    border: 0;
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .hb-strip {
    grid-area: strip;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .hb-thumb {
    position: relative;
    display: grid;
    grid-template: "n mark" auto ". ." 1fr "name name" auto / auto 1fr;
    aspect-ratio: 16 / 9;
    padding: var(--space-2);
    overflow: hidden;
    border: 2px solid var(--set-line);
    border-radius: var(--radius-md);
    background: var(--set-well);
    color: var(--foreground);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .hb-thumb[aria-current="true"] {
    border-color: var(--primary);
  }

  .hb-thumb img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hb-thumb[data-state="locked"] img {
    filter: grayscale(1) brightness(0.45);
  }

  .hb-thumb > span {
    position: relative;
    font-weight: 700;
  }

  .hb-tn {
    grid-area: n;
    font-size: var(--text-xl);
    line-height: 1;
  }

  .hb-tmark {
    grid-area: mark;
    justify-self: end;
    display: inline-flex;
    padding: 0 var(--space-2);
    border-radius: var(--radius-full);
    background: var(--surface);
    font-size: var(--text-xs);
    line-height: 1.6;
  }

  .hb-tmark:empty {
    display: none;
  }

  .hb-tname {
    grid-area: name;
    padding: 0 var(--space-1);
    border-radius: var(--radius-xs);
    justify-self: start;
    background: var(--surface);
    font-size: var(--text-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  @media (max-height: 500px) {
    .hb {
      grid-template: "top" auto "copy" minmax(0, 1fr) "strip" auto / minmax(0, 1fr);
      gap: var(--space-3);
      padding: var(--space-4);
    }

    .hb-tower {
      display: none;
    }

    .hb-me {
      display: inline-flex;
    }

    h2 {
      font-size: var(--text-3xl);
    }

    .hb-rule {
      font-size: var(--text-md);
    }

    .hb-bonus {
      display: none;
    }

    .hb-cta {
      margin-top: 0;
    }

    .hb-go {
      height: var(--control-h);
      padding: 0 var(--space-5);
      font-size: var(--text-lg);
    }

    .hb-strip {
      gap: var(--space-2);
    }

    .hb-thumb {
      padding: var(--space-1);
      border-radius: var(--radius-sm);
    }

    .hb-tname {
      display: none;
    }
  }
</style>
