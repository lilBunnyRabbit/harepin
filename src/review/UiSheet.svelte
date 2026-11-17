<script lang="ts">
  import type { CarClass } from "../car/pi";
  import BackPill from "../menu/ui/BackPill.svelte";
  import Card from "../menu/ui/Card.svelte";
  import Chip from "../menu/ui/Chip.svelte";
  import ClassBadge from "../menu/ui/ClassBadge.svelte";
  import Kbd from "../menu/ui/Kbd.svelte";
  import KeyButton from "../menu/ui/KeyButton.svelte";
  import KeyLink from "../menu/ui/KeyLink.svelte";
  import PageFrame from "../menu/ui/PageFrame.svelte";
  import PlaceLine from "../menu/ui/PlaceLine.svelte";
  import PrimaryAction from "../menu/ui/PrimaryAction.svelte";
  import Row from "../menu/ui/Row.svelte";
  import RowList from "../menu/ui/RowList.svelte";
  import SectionHead from "../menu/ui/SectionHead.svelte";
  import Stations from "../menu/ui/Stations.svelte";

  const STATIONS = [
    { id: "home", label: "Home" },
    { id: "events", label: "Events" },
    { id: "garage", label: "Garage" },
    { id: "online", label: "Online" },
    { id: "settings", label: "Settings" },
  ] as const;
  const CLASSES: [CarClass, number][] = [
    ["d", 318],
    ["c", 455],
    ["b", 612],
    ["a", 730],
    ["s1", 842],
    ["s2", 921],
    ["x", 999],
  ];
  const PARTS = [
    { name: "Street", blurb: "The engine it left the factory with", state: "Fitted", icon: "icon-check" },
    { name: "Sport", blurb: "More pull out of slow corners", state: "Fits" },
    { name: "Race", blurb: "Lifts the car to the top of class B", state: "Fits" },
    { name: "Works", blurb: "Takes the car out of class B", state: "Over class" },
  ];
  const HERE = { here: true } as const;
  const DUNES = { here: false, name: "Dune sea · Sabkha", kind: "dunes" } as const;
  const noop = () => undefined;

  let station = $state<(typeof STATIONS)[number]["id"]>("home");
  let ghost = $state(true);
  let rival = $state(false);
</script>

{#snippet chips()}
  <Chip>★ 34</Chip>
  <Chip tone="live">38 online</Chip>
{/snippet}

<div class="sheet">
  <section class="screen" data-piece="frame-stage">
    <img class="scene" src="/menu/island.webp" alt="" />
    <PageFrame floor back={{ to: "Road", go: noop }} {chips}>
      {#snippet stations()}<Stations items={STATIONS} value={station} label="Stations" onchange={(id) => (station = id)} />{/snippet}
      {#snippet links()}
        <KeyLink keys={{ key: "C" }} onclick={noop}>Car</KeyLink>
        <KeyLink keys={{ key: "M" }} onclick={noop}>Maps</KeyLink>
      {/snippet}
      {#snippet primary()}<PrimaryAction onclick={noop}>Race Round 3</PrimaryAction>{/snippet}
      <div class="home">
        <div class="bay"><Chip><b>Sturm</b><ClassBadge rating={{ pi: 612, class: "b" }} /></Chip></div>
        <div class="stack">
          <Card focused wide class="grow">
            {#snippet picture()}<img src="/menu/island.webp" alt="" />{/snippet}
            <SectionHead eyebrow="Next · Harepin Series" title="Round 3 of 6 · Reverse run" role="page" level={2} />
            <PlaceLine place={HERE} tail="Island · Harwar" />
          </Card>
          <div class="trio">
            <Card flat pad="sm"><SectionHead eyebrow="Career" /><b>Sand trail</b></Card>
            <Card flat pad="sm"><SectionHead eyebrow="Today's run" /><b>Crater ring</b></Card>
            <Card flat pad="sm"><SectionHead eyebrow="Free roam" /><b>Island · Harwar</b></Card>
          </div>
        </div>
      </div>
    </PageFrame>
  </section>

  <section class="screen" data-piece="frame-veil">
    <img class="scene" src="/menu/dunes.webp" alt="" />
    <PageFrame veil={0.55} eyebrow="Garage" title="Sturm · Engine" back={{ to: "Garage", go: noop }} note="A tap only selects. Fit puts the part on the car." {chips}>
      {#snippet links()}<KeyLink keys={{ key: "B" }} onclick={noop}>Builds</KeyLink>{/snippet}
      {#snippet primary()}<PrimaryAction tone="online" onclick={noop}>Fit Race engine</PrimaryAction>{/snippet}
      <div class="garage">
        <Card>
          <SectionHead eyebrow="Dune sea · 2 events open" title="Dune sea · Sabkha" role="page" level={2} />
          <RowList>
            <Row fill focused label="Sand trail" help="Rookie · Time trial" onclick={noop}>
              {#snippet control()}<ClassBadge cap="c" />{/snippet}
            </Row>
            <Row fill label="Mirage gymkhana" help="Rookie · Gymkhana" onclick={noop}>
              {#snippet control()}<ClassBadge cap="b" />{/snippet}
            </Row>
            <Row fill label="Salt flats sprint" help="Club · Sprint" onclick={noop} />
          </RowList>
          <PlaceLine place={DUNES} tail="another map" />
        </Card>
        <Card>
          <div class="between">
            <SectionHead eyebrow="Sturm · Engine" title="Race" level={2} />
            <span class="plates"><ClassBadge rating={{ pi: 612, class: "b" }} /><ClassBadge rating={{ pi: 624, class: "b" }} /></span>
          </div>
          <RowList>
            {#each PARTS as part, index (part.name)}
              <Row fill focused={index === 2} icon="icon-slot-engine" label={part.name} help={part.blurb}>
                {#snippet control()}<Chip inner icon={part.icon}>{part.state}</Chip>{/snippet}
              </Row>
            {/each}
          </RowList>
        </Card>
      </div>
    </PageFrame>
  </section>

  <section class="pieces">
    <div class="group" data-piece="caps">
      <SectionHead eyebrow="Key cap" />
      <div class="line"><Kbd keys={["Esc", "Enter", "Q", "E", "Tab", "Shift"]} /></div>
    </div>

    <div class="group" data-piece="buttons">
      <SectionHead eyebrow="Key button" />
      <div class="line">
        <KeyButton keys={{ key: "Enter", pad: "A" }}>Race Round 3</KeyButton>
        <KeyButton keys={{ key: "Enter", pad: "A" }} tone="online">Join Aiko</KeyButton>
        <KeyButton keys={{ key: "Enter", pad: "A" }} disabled>Start</KeyButton>
        <KeyButton keys={{ key: "Enter", pad: "A" }} tone="online" disabled>Ready</KeyButton>
      </div>
      <div class="line">
        <KeyButton keys={{ key: "Tab", pad: "Y" }} hold={600} style="--held: 40%">Travel</KeyButton>
        <KeyButton keys={{ key: "Tab", pad: "Y" }} variant="quiet" hold={600} style="--held: 40%">Leave room</KeyButton>
        <KeyButton keys={{ key: "R", pad: "X" }} variant="quiet">Restart</KeyButton>
        <BackPill to="Home" onclick={noop} />
        <KeyLink keys={{ key: "M", pad: "X" }} onclick={noop}>Maps</KeyLink>
      </div>
    </div>

    <div class="group" data-piece="plates">
      <SectionHead eyebrow="Class badge" />
      <div class="line">
        {#each CLASSES as [cls, pi] (cls)}<ClassBadge rating={{ pi, class: cls }} />{/each}
        <ClassBadge cap="b" />
        <ClassBadge rating={{ pi: 612, class: "b" }} size="lg" />
      </div>
    </div>

    <div class="group" data-piece="places">
      <SectionHead eyebrow="Place line" />
      <div class="line">
        <PlaceLine place={HERE} />
        <PlaceLine place={HERE} tail="340 m ahead" />
        <PlaceLine place={DUNES} />
        <PlaceLine place={DUNES} tail="another map" />
      </div>
    </div>

    <div class="group" data-piece="chips">
      <SectionHead eyebrow="Chip" />
      <div class="line">
        <Chip>2 450 cr</Chip>
        <Chip tone="live">38 online</Chip>
        <Chip tone="error">Offline</Chip>
        <Chip icon="icon-slot-engine">Engine</Chip>
        <Chip icon="icon-slot-tyres" focused>Tyres</Chip>
        <Chip variant="toggle" bind:pressed={ghost}>Ghost</Chip>
        <Chip variant="toggle" bind:pressed={rival}>Rival</Chip>
        <Chip inner>Fits</Chip>
        <Chip inner icon="icon-check">Fitted</Chip>
      </div>
    </div>

    <div class="group" data-piece="stations">
      <SectionHead eyebrow="Stations bar" />
      <div class="line"><Stations items={STATIONS} value="garage" label="Stations sample" /></div>
    </div>

    <div class="group" data-piece="cards">
      <SectionHead eyebrow="Card" />
      <div class="cards">
        <Card><SectionHead eyebrow="Padded" title="Card" level={3} /><span>Surface, strong line, one shadow.</span></Card>
        <Card focused><SectionHead eyebrow="Focused" title="Card" level={3} /><span>The cursor is here.</span></Card>
        <Card flat><SectionHead eyebrow="Flat" title="Card" level={3} /><span>One of a grid: no shadow.</span></Card>
        <Card selected onclick={noop}><SectionHead eyebrow="Selected" title="Card" level={3} /><span>A pick that is kept.</span></Card>
        <Card pad="sm" class="tall">
          {#snippet picture()}<img src="/menu/volcano.webp" alt="" />{/snippet}
          <SectionHead eyebrow="Picture" />
          <b>Volcano · Kaldera</b>
        </Card>
      </div>
    </div>

    <div class="group" data-piece="rows">
      <SectionHead eyebrow="List row" />
      <div class="cards">
        <Card list>
          <RowList>
            <Row fill label="Resume" onclick={noop} />
            <Row fill focused label="Restart event" onclick={noop} />
            <Row fill label="Road map" icon="icon-globe" onclick={noop} />
            <Row fill label="Best lap">
              {#snippet control()}<span class="value">1:12.4</span>{/snippet}
            </Row>
          </RowList>
        </Card>
        <Card list>
          <RowList>
            <Row label="Plain row" />
            <Row focused label="Plain row, focused" />
            <Row label="With help" help="A second, quieter line under the label" />
          </RowList>
        </Card>
        <Card list>
          <RowList divided>
            <Row label="Bloom" help="Glow on lights">
              {#snippet control()}<Chip inner>On</Chip>{/snippet}
            </Row>
            <Row focused label="Shadows">
              {#snippet control()}<Chip inner>High</Chip>{/snippet}
            </Row>
            <Row label="Draw distance">
              {#snippet control()}<Chip inner>Far</Chip>{/snippet}
            </Row>
          </RowList>
        </Card>
      </div>
    </div>
  </section>
</div>

<style>
  .sheet {
    display: grid;
    font-size: var(--type-body);
    font-weight: 500;
    line-height: 1.35;
  }

  .screen {
    position: relative;
    height: 100vh;
    overflow: hidden;
    background: var(--background-darkest);
  }

  .scene {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .home,
  .garage {
    display: grid;
    grid-template-columns: 1fr 47%;
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .garage {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }

  .bay {
    align-self: end;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    min-height: 0;
  }

  .stack :global(.grow) {
    flex: 1;
  }

  .trio {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--gap);
  }

  .between,
  .plates {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-sm);
  }

  .pieces {
    display: grid;
    gap: var(--space-8);
    padding: var(--space-8) var(--inset);
  }

  .group {
    display: grid;
    gap: var(--gap-md);
    min-width: 0;
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gap);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--gap);
    align-items: start;
  }

  .cards :global(.tall) {
    height: 200px;
  }

  .value {
    color: var(--dim);
    font-family: var(--font-mono);
    font-weight: 700;
  }
</style>
