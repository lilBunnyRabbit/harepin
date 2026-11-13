<script lang="ts">
  import type { CarShelf } from "../car/car-pick";
  import { CLASS_LABELS } from "../car/pi";
  import { car_facts } from "./car-facts";
  import CarFactsLine from "./CarFactsLine.svelte";
  import Badge from "./ui/Badge.svelte";
  import Button from "./ui/Button.svelte";
  import Dialog from "./ui/Dialog.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import ScrollArea from "./ui/ScrollArea.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import SpecCard from "./ui/SpecCard.svelte";

  interface Props {
    title: string;
    limit: string;
    shelves: readonly CarShelf[];
    onpick: (code: string | null) => void;
    ongarage?: () => void;
  }

  let { title, limit, shelves, onpick, ongarage }: Props = $props();

  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  let open = $state(true);
  let picked: string | null = null;
  let garage = false;
  let strip = $state<HTMLElement | null>(null);
  let shown = $state<ReadonlySet<string>>(new Set());

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
    const tile = strip.querySelector<HTMLElement>("[data-fitted] .ui-spec-card");
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
                  {@const facts = car_facts(choice.build)}
                  <li data-fitted={choice.fitted || undefined}>
                    {#snippet line()}<CarFactsLine {facts} />{/snippet}
                    {#snippet tag()}
                      {#if choice.blocked}<span class="pick-reason">{choice.blocked}</span>
                      {:else if choice.recommended}<Badge tone="primary">Recommended</Badge>
                      {:else if choice.own}<span class="pick-own"><Badge>Your car</Badge></span>{/if}
                    {/snippet}
                    <SpecCard
                      title={choice.title}
                      meta={choice.sub || "Your garage build"}
                      rating={choice.rating}
                      meters={facts.meters}
                      facts={line}
                      tag={choice.blocked || choice.recommended || choice.own ? tag : undefined}
                      selected={choice.fitted}
                      disabled={choice.blocked !== null}
                      onclick={() => pick(choice.code)}
                    />
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
    --pick-shelf: 500px;
    --pick-row-card: 480px;
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
    flex: 0 0 min(var(--pick-shelf), calc(100% - var(--space-8)));
    gap: var(--space-3);
    scroll-snap-align: start;
  }

  ol {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
  }

  .pick-reason {
    color: var(--foreground);
  }

  /* The neutral badge is the card's own fill; the well tone makes it read as a tag. */
  .pick-own :global(.ui-badge) {
    background: var(--set-well);
  }

  /* Short screens, a phone on its side: a class lays its cards out in a row, so one shows whole without the dialog
     scrolling. */
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
      flex: 0 0 var(--pick-row-card);
      scroll-snap-align: start;
    }
  }
</style>
