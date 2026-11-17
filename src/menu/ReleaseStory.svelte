<script lang="ts">
  import { SLOTS } from "../car/build";
  import { CARS, type CarId } from "../car/cars";
  import type { Release } from "../changelog";
  import CarFactsLine from "./CarFactsLine.svelte";
  import CarStill from "./CarStill.svelte";
  import KindBadge from "./KindBadge.svelte";
  import { car_facts } from "./car-facts";
  import { still_build } from "./still-build";
  import type { Story } from "./release-story";
  import Badge from "./ui/Badge.svelte";

  interface Props {
    release: Release;
    story: Story;
  }

  let { release, story }: Props = $props();

  const KIT = SLOTS.aero.parts.findIndex((part) => part.name === "Race kit");
  const before = (car: CarId) => `${import.meta.env.BASE_URL}release/before/${car}.webp`;

  // The before pictures stay out of the offline cache, so a pair must hold without one.
  let lost = $state<CarId[]>([]);
</script>

<article class="story">
  <header class="story-head">
    <p class="story-meta">
      <Badge>Big update</Badge>
      <span>v{release.version}</span>
      <time datetime={release.date}>{release.date}</time>
    </p>
    <h3 class="story-title">{release.title}</h3>
    <div class="story-lineup">
      {#each story.lineup as car (car)}
        <figure>
          <CarStill {car} />
          <figcaption>{CARS[car].name}</figcaption>
        </figure>
      {/each}
    </div>
  </header>

  {#each story.blocks as block, index (index)}
    {#if block.type === "cars"}
      <section class="story-block">
        {#if block.head !== block.cards[0].highlight}
          <h4 class="story-heading">{block.head.title} <KindBadge kind={block.head.kind} /></h4>
          <p class="story-text">{block.head.text}</p>
        {/if}
        <div class="story-cars">
          {#each block.cards as { highlight, car } (highlight.title)}
            <article class="story-car">
              {#if car}
                <CarStill {car} label={highlight.title} />
              {:else}
                <div class="story-coming"><Badge>Coming soon</Badge></div>
              {/if}
              <h5>{highlight.title}</h5>
              <p class="story-text">{highlight.text}</p>
              {#if car}<CarFactsLine facts={car_facts(still_build(car))} words />{/if}
            </article>
          {/each}
        </div>
      </section>
    {:else if block.type === "pairs"}
      <section class="story-block">
        <h4 class="story-heading">{block.head.title} <KindBadge kind={block.head.kind} /></h4>
        <p class="story-text">{block.head.text}</p>
        <div class="story-pairs">
          {#each block.cars as car (car)}
            <div class="story-pair">
              {#if !lost.includes(car)}
                <figure class="story-was">
                  <img src={before(car)} alt="" loading="lazy" onerror={() => lost.push(car)} />
                  <figcaption>Before</figcaption>
                </figure>
              {/if}
              <figure>
                <CarStill {car} aero={KIT} />
                <figcaption><b>{CARS[car].name}</b> {SLOTS.aero.parts[KIT].name}</figcaption>
              </figure>
            </div>
          {/each}
        </div>
      </section>
    {:else if block.type === "tease"}
      <section class="story-tease">
        {#if block.car}<CarStill car={block.car} outline label="The outline of a car" />{/if}
        <div class="story-tease-text">
          <KindBadge kind={block.highlight.kind} />
          <h4 class="story-heading">{block.highlight.title}</h4>
          <p class="story-text">{block.highlight.text}</p>
        </div>
      </section>
    {:else}
      <section class="story-block">
        <h4 class="story-heading">Also new</h4>
        <ul class="story-also">
          {#each block.items as item (item.title)}
            <li>
              <b>{item.title}</b>
              <span class="story-text">{item.text}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/each}
</article>

<style>
  .story {
    display: grid;
    gap: calc(2 * var(--gap));
    min-width: 0;
  }

  .story-head,
  .story-block {
    display: grid;
    gap: var(--gap);
    min-width: 0;
  }

  .story-meta {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    margin: 0;
    color: var(--dim);
    font-family: var(--font-mono);
    font-size: var(--type-small);
  }

  .story-title,
  .story-heading,
  h5 {
    margin: 0;
    font-weight: 800;
    line-height: 1.15;
    text-wrap: balance;
  }

  .story-title {
    font-size: var(--type-h1);
  }

  .story-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gap-sm) var(--gap-md);
    font-size: var(--type-h2);
  }

  h5 {
    font-size: var(--type-h2);
  }

  .story-text {
    max-width: 65ch;
    margin: 0;
    color: var(--dim);
    font-size: var(--type-body);
    line-height: 1.5;
    text-wrap: pretty;
  }

  figure {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
    margin: 0;
  }

  figcaption {
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 600;
  }

  .story-lineup {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: var(--gap-sm);
    padding: var(--gap) var(--gap-md) var(--gap-md);
    border-radius: var(--radius-lg);
    background: var(--row);
  }

  .story-lineup figcaption {
    text-align: center;
  }

  .story-cars {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--gap);
  }

  .story-car {
    display: grid;
    align-content: start;
    gap: var(--gap-sm);
    min-width: 0;
    padding: var(--pad);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }

  .story-coming {
    display: grid;
    place-items: center;
    aspect-ratio: 16 / 9;
    border-radius: var(--radius-md);
    background: var(--row);
  }

  .story-pairs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--gap-md);
  }

  .story-pair {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    align-items: end;
    gap: var(--gap-md);
    padding: var(--gap-md) var(--gap);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .story-pair figcaption {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--gap-sm);
    line-height: 1.5;
  }

  .story-pair b {
    color: var(--foreground);
    font-size: var(--type-body);
  }

  .story-was img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    opacity: 0.7;
  }

  .story-was figcaption {
    line-height: calc(var(--type-body) * 1.5);
  }

  .story-tease {
    display: grid;
    grid-template-columns: minmax(0, 6fr) minmax(0, 5fr);
    align-items: center;
    gap: calc(2 * var(--gap-md));
    padding: var(--pad);
    border-radius: var(--radius-lg);
    background: var(--row);
  }

  .story-tease-text {
    display: grid;
    justify-items: start;
    gap: var(--gap-md);
  }

  .story-also {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--gap-md);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .story-also li {
    display: grid;
    align-content: start;
    gap: var(--gap-xs);
    padding: var(--gap);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  .story-also b {
    font-size: var(--type-h3);
    font-weight: 700;
  }

  .story-also .story-text {
    font-size: var(--type-body);
  }

  @media (max-width: 600px) {
    .story-lineup {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-auto-flow: row;
    }

    .story-cars,
    .story-pairs,
    .story-tease,
    .story-also {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
