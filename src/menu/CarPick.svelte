<script lang="ts">
  import { SLOTS, build_spec, stats, type Stats } from "../car/build";
  import type { CarChoice, CarShelf } from "../car/car-pick";
  import { CLASS_LABELS } from "../car/pi";
  import { STAT_NAMES, bar_of, stat_rating } from "./garage-meters";
  import Button from "./ui/Button.svelte";
  import ClassBadge from "./ui/ClassBadge.svelte";
  import Dialog from "./ui/Dialog.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import Progress from "./ui/Progress.svelte";
  import ScrollArea from "./ui/ScrollArea.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import Tile from "./ui/Tile.svelte";

  interface Props {
    title: string;
    limit: string;
    shelves: readonly CarShelf[];
    onpick: (code: string | null) => void;
    ongarage?: () => void;
  }

  let { title, limit, shelves, onpick, ongarage }: Props = $props();

  const METERS: readonly (keyof Stats)[] = ["power", "grip", "top_speed"];
  const KG = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  let open = $state(true);
  let picked: string | null = null;
  let garage = false;
  let strip = $state<HTMLElement | null>(null);
  let shown = $state<ReadonlySet<string>>(new Set());

  function facts(choice: CarChoice) {
    const spec = build_spec(choice.build);
    const now = stats(spec);
    return {
      drive: spec.drive.toUpperCase(),
      tyres: SLOTS.tyres.parts[choice.build.parts.tyres]?.name ?? "Street",
      weight: `${KG.format(spec.mass)} kg`,
      meters: METERS.map((key) => ({ key, value: stat_rating(key, now[key]), bar: bar_of(key, now[key]) * 100 })),
    };
  }

  const scroller = () => strip?.closest<HTMLElement>(".ui-scroll");
  // The strip snaps to class columns, or to single cards where a short screen lays a class out in a row.
  const snaps = () => [...(strip?.querySelectorAll<HTMLElement>("[data-shelf], [data-shelf] li") ?? [])].filter((el) => getComputedStyle(el).scrollSnapAlign !== "none");
  const offset = (box: HTMLElement, el: HTMLElement) => box.scrollLeft + el.getBoundingClientRect().left - box.getBoundingClientRect().left;

  // A target past the scroll end would leave a column cut at the left edge: the last start that fits is taken
  // instead, as long as the target still shows whole.
  function go(el: HTMLElement, behavior: ScrollBehavior) {
    const box = scroller();
    if (!box) return;
    const max = box.scrollWidth - box.clientWidth;
    let left = offset(box, el);
    if (left > max) {
      const end = left + el.getBoundingClientRect().width;
      const fits = snaps()
        .map((snap) => offset(box, snap))
        .filter((start) => start <= max && start + box.clientWidth >= end);
      left = fits.length ? Math.max(...fits) : max;
    }
    box.scrollTo({ left, behavior });
  }

  // A frame late: the dialog's showModal runs after this effect, and a closed dialog has no layout to scroll.
  $effect(() => {
    if (!strip) return;
    const tile = strip.querySelector<HTMLElement>("[data-fitted] .ui-tile");
    const frame = requestAnimationFrame(() => {
      const target = snaps().find((el) => tile && el.contains(tile));
      if (target) go(target, "instant");
      if (tile && !tile.matches(":disabled")) tile.focus({ preventScroll: true, focusVisible: matchMedia("(pointer: fine)").matches });
    });
    return () => cancelAnimationFrame(frame);
  });

  // A class lights when most of it shows, or when it fills most of the strip, as a long row of cards does.
  $effect(() => {
    const root = scroller();
    if (!strip || !root) return;
    const seen = new Set<string>();
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const name = entry.target instanceof HTMLElement ? entry.target.dataset.shelf : undefined;
          if (!name) continue;
          const width = entry.rootBounds?.width ?? Infinity;
          if (entry.intersectionRatio >= 0.6 || entry.intersectionRect.width >= width * 0.6) seen.add(name);
          else seen.delete(name);
        }
        shown = new Set(seen);
      },
      { root, threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] },
    );
    for (const el of strip.querySelectorAll("[data-shelf]")) watch.observe(el);
    return () => watch.disconnect();
  });

  const motion = (): ScrollBehavior => (calm.matches ? "instant" : "smooth");

  function jump(name: string) {
    const el = strip?.querySelector<HTMLElement>(`[data-shelf="${name}"]`);
    if (el) go(el, motion());
  }

  // One snap stop per press: the next column, or the next card in a short screen's row.
  function page(dir: -1 | 1) {
    const box = scroller();
    if (!box) return;
    const starts = snaps().map((el) => offset(box, el));
    const now = box.scrollLeft;
    const next = dir > 0 ? starts.find((start) => start > now + 1) : starts.findLast((start) => start < now - 1);
    box.scrollTo({ left: next ?? (dir > 0 ? box.scrollWidth : 0), behavior: motion() });
  }

  export function close() {
    picked = null;
    open = false;
  }

  function pick(code: string) {
    picked = code;
    open = false;
  }

  function to_garage() {
    picked = null;
    garage = true;
    open = false;
  }

  function closed() {
    onpick(picked);
    if (garage) ongarage?.();
  }
</script>

<Dialog bind:open {title} wide onclose={closed}>
  <div class="pick">
    <div class="pick-head">
      <p class="limit">{limit}</p>
      <nav class="pick-nav" aria-label="Car classes">
        <IconButton class="pick-arrow pick-prev" icon="icon-back" label="Scroll back" tabindex={-1} onclick={() => page(-1)} />
        {#each shelves as shelf (shelf.class)}
          <Button size="sm" class={["pick-chip", !shelf.open && "pick-closed"]} aria-current={shown.has(shelf.class) || undefined} onclick={() => jump(shelf.class)}>
            {CLASS_LABELS[shelf.class]}
          </Button>
        {/each}
        <IconButton class="pick-arrow pick-next" icon="icon-back" flip label="Scroll on" tabindex={-1} onclick={() => page(1)} />
      </nav>
    </div>

    <div class="strip">
      <ScrollArea axis="x" fade={false} label="Cars by class">
        <div class="classes" bind:this={strip}>
          {#each shelves as shelf (shelf.class)}
            <section class="shelf" data-shelf={shelf.class}>
              <SectionHead eyebrow={shelf.head} />
              <ol>
                {#each shelf.choices as choice (choice.code)}
                  {@const spec = facts(choice)}
                  <li data-fitted={choice.fitted || undefined}>
                    {#snippet why()}{choice.blocked}{/snippet}
                    {#snippet badge()}<ClassBadge rating={choice.rating} />{/snippet}
                    {#snippet sheet()}
                      <dl class="pick-facts">
                        <div><dt>Drive</dt><dd>{spec.drive}</dd></div>
                        <div><dt>Tyres</dt><dd>{spec.tyres}</dd></div>
                        <div><dt>Weight</dt><dd>{spec.weight}</dd></div>
                      </dl>
                      <p class="pick-line">{spec.drive} · {spec.tyres} · {spec.weight}</p>
                      <div class="pick-meters">
                        {#each spec.meters as meter (meter.key)}
                          <div class="pick-meter">
                            <span class="pick-label">{STAT_NAMES[meter.key]}</span>
                            <span class="pick-value">{meter.value}</span>
                            <div class="pick-bar"><Progress value={meter.bar} max={100} label={STAT_NAMES[meter.key]} /></div>
                          </div>
                        {/each}
                      </div>
                    {/snippet}
                    <Tile
                      title={choice.title}
                      meta={choice.sub || "Your garage build"}
                      clamp={1}
                      selected={choice.fitted}
                      disabled={choice.blocked !== null}
                      reason={choice.blocked ? why : undefined}
                      detail={sheet}
                      aside={badge}
                      onclick={() => pick(choice.code)}
                    >
                      {#if !choice.blocked || choice.own || choice.fitted}
                        <span class="pick-tags" class:lift={!choice.blocked}>
                          {#if choice.own}<span class="own">Your car</span>{/if}
                          {#if choice.recommended}<span class="rec">Recommended</span>{/if}
                          {#if choice.fitted}<span class="why">Fitted</span>{/if}
                        </span>
                      {/if}
                    </Tile>
                  </li>
                {/each}
              </ol>
            </section>
          {/each}
        </div>
      </ScrollArea>
    </div>
  </div>

  {#snippet actions()}
    {#if ongarage}<Button variant="quiet" onclick={to_garage}>Garage</Button>{/if}
    <Button variant="quiet" onclick={() => (open = false)}>Back</Button>
  {/snippet}
</Dialog>

<style>
  .pick {
    display: grid;
    gap: var(--space-5);
    timeline-scope: --car-strip;
  }

  .pick-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3) var(--space-5);
  }

  .limit {
    margin: 0;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--primary);
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--primary) 16%, transparent);
    color: var(--foreground);
    font-size: var(--text-lg);
    font-weight: 700;
  }

  .pick-nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .pick-nav :global(.pick-chip) {
    min-width: var(--control-h);
    border-radius: var(--radius-full);
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .pick-nav :global(.pick-closed) {
    color: var(--set-dim);
  }

  .pick-nav :global(.pick-chip[aria-current="true"]) {
    border-color: var(--primary);
    background: color-mix(in oklch, var(--primary) 16%, transparent);
  }

  /* The GarageStrip arrows: the strip's scroll timeline shows them and greys the one at an end. Collapsed to no width
     until then, not display: none, which never runs an animation; so with nothing to scroll they take no room.
     Longhands, since the minifier drops a shorthand's `linear both`. */
  .pick-nav :global(.pick-arrow) {
    visibility: hidden;
    width: 0;
    border-width: 0;
    border-color: var(--set-line);
    background: var(--set-raised);
    animation-timing-function: linear;
    animation-fill-mode: both;
    animation-timeline: --car-strip;
  }

  .pick-nav :global(.pick-prev) {
    margin-right: calc(-1 * var(--space-2));
    animation-name: pick-arrow-in;
    animation-range: 0 var(--space-6);
  }

  .pick-nav :global(.pick-next) {
    margin-left: calc(-1 * var(--space-2));
    animation-name: pick-arrow-out;
    animation-range: calc(100% - var(--space-6)) 100%;
  }

  @keyframes pick-arrow-in {
    from {
      visibility: visible;
      width: var(--control-h);
      margin: 0;
      border-width: 1px;
      opacity: 0.35;
      cursor: default;
    }
    to {
      visibility: visible;
      width: var(--control-h);
      margin: 0;
      border-width: 1px;
      opacity: 1;
    }
  }

  @keyframes pick-arrow-out {
    from {
      visibility: visible;
      width: var(--control-h);
      margin: 0;
      border-width: 1px;
      opacity: 1;
    }
    to {
      visibility: visible;
      width: var(--control-h);
      margin: 0;
      border-width: 1px;
      opacity: 0.35;
      cursor: default;
    }
  }

  /* A finger swipes the strip; the arrows are for a mouse, as in the garage. */
  @media (pointer: coarse) {
    .pick-nav :global(.pick-arrow) {
      display: none;
    }
  }

  .strip {
    min-width: 0;
  }

  .strip :global(.ui-scroll) {
    scroll-snap-type: x mandatory;
    scroll-timeline: --car-strip inline;
  }

  .classes {
    display: flex;
    align-items: start;
    gap: var(--space-5);
  }

  .shelf {
    display: grid;
    flex: 0 0 min(320px, calc(100% - var(--space-8)));
    gap: var(--space-3);
    scroll-snap-align: start;
  }

  ol {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
  }

  /* Sized for a tag even when a car has none, so every card keeps one height. */
  .pick-tags {
    display: flex;
    height: var(--space-5);
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  /* A blocked car's row sits in the tile's foot, which already has this gap above it. */
  .lift {
    margin-top: var(--space-1);
  }

  .rec {
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--primary);
    color: var(--on-primary);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .own {
    padding: 0 var(--space-2);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-sm);
    color: var(--foreground);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .why {
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .pick-facts,
  .pick-meters {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
  }

  .pick-facts {
    padding-top: var(--space-3);
    border-top: 1px solid var(--set-line);
  }

  .pick-meters {
    margin-top: var(--space-3);
  }

  dt,
  .pick-label {
    overflow: hidden;
    color: var(--set-dim);
    font-size: var(--text-xs);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  dd {
    overflow: hidden;
    margin: 0;
    font-size: var(--text-md);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pick-meter {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    column-gap: var(--space-1);
  }

  .pick-value {
    font-family: var(--font-mono);
    font-size: var(--text-md);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .pick-bar {
    grid-column: 1 / -1;
    margin-top: var(--space-1);
  }
  .pick-line {
    display: none;
  }

  /* Short screens, a phone on its side: a class lays its cards out in a row and each card is compact, so one shows
     whole without the dialog scrolling. */
  @media (max-height: 500px) {
    .pick {
      gap: var(--space-3);
    }

    .shelf {
      flex: none;
      gap: var(--space-2);
      scroll-snap-align: none;
    }

    ol {
      display: flex;
    }

    li {
      flex: 0 0 280px;
      scroll-snap-align: start;
    }

    li :global(.ui-tile[data-detail]) {
      gap: var(--space-2);
      padding: var(--space-3);
    }

    .pick-facts {
      display: none;
    }

    .pick-line {
      display: block;
      overflow: hidden;
      margin: 0;
      padding-top: var(--space-2);
      border-top: 1px solid var(--set-line);
      font-size: var(--text-sm);
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pick-meters {
      margin-top: var(--space-2);
    }

    .pick-bar {
      margin-top: var(--space-0);
    }

    .pick-bar :global(.ui-progress) {
      --track-h: var(--space-1);
    }
  }
</style>
