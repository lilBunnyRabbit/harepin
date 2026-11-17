<script lang="ts">
  import { untrack } from "svelte";
  import { random_name } from "../guide-rules";
  import type { Menu } from "../page";
  import Card from "../ui/Card.svelte";
  import IconButton from "../ui/IconButton.svelte";
  import type { MenuState } from "../ui/menu-state.svelte";
  import TextField from "../ui/TextField.svelte";

  interface Props {
    menu: Menu;
    live: MenuState;
  }

  let { menu, live }: Props = $props();

  const fallback = $derived(live.live(() => menu.host.name()));
  let name = $state(untrack(() => live.prefs.name ?? ""));
  const tag = $derived(name.trim() || fallback);

  function commit() {
    const next = name.trim() || null;
    if (next !== live.prefs.name) live.set("name", next);
  }

  function roll() {
    name = random_name(tag);
    live.set("name", name);
  }

  $effect(() => commit);
</script>

<div class="wel-name">
  <Card label="Your name">
    <div class="wel-say">
      <b class="wel-display">What do we call you?</b>
      <p class="wel-lede">Harepin is a small driving game: a mainland to roam, mini maps for quick runs, friends a link away.</p>
    </div>
    <div class="wel-field">
      <span class="wel-eyebrow">Your name</span>
      <div class="wel-row">
        <TextField
          bind:value={name}
          aria-label="Your name"
          placeholder={fallback}
          maxlength={24}
          enterkeyhint="done"
          onchange={commit}
          onkeydown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
        <IconButton icon="icon-dice" label="Another name" title="Another name" shape="round" onclick={roll} />
      </div>
      <span class="wel-help">Others see it above your car. Change it any time from the name chip in the menu.</span>
    </div>
  </Card>
  <Card pad="none" class="wel-shot" label="How others see you">
    <img src={`${import.meta.env.BASE_URL}menu/${menu.host.kind}.webp`} alt="" />
    <span class="wel-tag">{tag}</span>
  </Card>
</div>

<style>
  .wel-name {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
    gap: var(--gap);
    height: 100%;
    min-height: 0;
  }

  .wel-name > :global(.ui-card) {
    justify-content: space-between;
    gap: var(--pad);
  }

  .wel-say,
  .wel-field {
    display: grid;
    gap: var(--gap-sm);
    min-width: 0;
  }

  .wel-display {
    color: var(--cottontail);
    font-size: var(--display-1);
    font-weight: 800;
    line-height: 1;
    text-wrap: balance;
  }

  .wel-lede {
    max-width: 44ch;
    margin: 0;
    color: var(--dim);
    font-size: var(--type-h3);
    font-weight: 500;
    line-height: 1.4;
    text-wrap: pretty;
  }

  .wel-eyebrow {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .wel-row {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
  }

  .wel-row > :global(.ui-field) {
    flex: 1;
  }

  .wel-help {
    color: var(--dim);
    font-size: var(--type-small);
    line-height: 1.4;
    text-wrap: pretty;
  }

  .wel-name > :global(.wel-shot) {
    position: relative;
    overflow: hidden;
  }

  .wel-name > :global(.wel-shot > img) {
    width: 100%;
    height: 100%;
    min-height: 0;
    object-fit: cover;
  }

  .wel-tag {
    position: absolute;
    top: 38%;
    left: 50%;
    translate: -50% 0;
    max-width: 80%;
    padding: var(--gap-xs) var(--gap-md);
    overflow: hidden;
    border-radius: var(--radius-full);
    background: color-mix(in oklch, var(--background-darkest) 70%, transparent);
    color: var(--foreground);
    font-size: var(--type-h3);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-height: 500px) {
    .wel-name {
      height: auto;
      min-height: 100%;
    }
  }
</style>
