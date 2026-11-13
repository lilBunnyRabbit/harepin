<script lang="ts">
  import { TIERS, current_tier, type CareerEvent } from "../career/career";
  import { career_total, goals, tier_views, trophy_count } from "../career/career-model";
  import { owner_times } from "../career/career-store";
  import CareerDone from "./CareerDone.svelte";
  import CareerGoals from "./CareerGoals.svelte";
  import CareerProfile from "./CareerProfile.svelte";
  import CareerSpine from "./CareerSpine.svelte";
  import TrophyCase from "./TrophyCase.svelte";
  import Button from "./ui/Button.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";
  import { COPIED_MS } from "./widgets";

  interface Props extends PageProps {
    /** `?tune`: every tier plays as open, and the owner copies their own runs' times. */
    tune: boolean;
  }

  let { menu, live, tune }: Props = $props();

  const career = $derived(menu.host.career);
  const views = $derived(tier_views(live.stars, tune));
  const here = $derived(views[TIERS.indexOf(current_tier(live.stars))]);
  const total = $derived(career_total(live.stars));
  const aims = $derived(goals(live.stars));
  const trophies = $derived(trophy_count(views));
  const start = (event: CareerEvent) => menu.host.start_event(event.id);
  let copied = $state("");

  async function copy_times() {
    try {
      await navigator.clipboard.writeText(owner_times(career));
      copied = "Copied";
    } catch (error) {
      console.warn("career: clipboard refused", error);
      copied = "Copy failed";
    }
    setTimeout(() => (copied = ""), COPIED_MS);
  }
</script>

<div class="cr-page">
  <aside class="cr-me" aria-label="Your career">
    <CareerProfile {here} {total} />
    {#if aims.length}
      <section class="cr-next" aria-label="Next up">
        <h3>Next up</h3>
        <CareerGoals goals={aims} onstart={start} />
      </section>
    {:else}
      <CareerDone {here} {trophies} />
    {/if}
    {#if tune}<div><Button onclick={copy_times}>{copied || "Copy my times"}</Button></div>{/if}
  </aside>

  <section class="cr-path" aria-label="Career path">
    <CareerSpine {views} {menu} {live} {tune} />
  </section>

  <div class="cr-case"><TrophyCase {views} /></div>
</div>

<style>
  .cr-page {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 21rem;
    grid-template-areas: "path me" "path case" "path .";
    grid-template-rows: auto auto 1fr;
    align-items: start;
    gap: var(--space-6) var(--space-8);
  }

  h3 {
    margin: 0;
    font-size: var(--text-xl);
  }

  .cr-me {
    grid-area: me;
    display: grid;
    gap: var(--space-6);
  }

  .cr-next {
    display: grid;
    gap: var(--space-3);
  }

  .cr-path {
    grid-area: path;
    min-width: 0;
  }

  .cr-case {
    grid-area: case;
  }

  @media (max-width: 1000px), (max-height: 500px) {
    .cr-page {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: "me" "path" "case";
      grid-template-rows: none;
      gap: var(--space-6);
    }

    .cr-me {
      gap: var(--space-3);
    }

    .cr-next h3 {
      display: none;
    }
  }
</style>
