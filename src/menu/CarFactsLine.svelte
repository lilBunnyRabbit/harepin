<script lang="ts">
  import type { CarFacts } from "./car-facts";
  import Icon from "./ui/Icon.svelte";

  interface Props {
    facts: CarFacts;
    words?: boolean;
  }

  let { facts, words = false }: Props = $props();
</script>

<span class="car-facts">
  {#each [facts.drive, facts.tyres] as fact (fact.icon)}
    {#if words}
      <span class="car-fact" title={fact.label}><Icon name={fact.icon} /><span class="car-fact-word">{fact.word}</span></span>
    {:else}
      <span class="car-fact" role="img" aria-label={fact.label} title={fact.label}><Icon name={fact.icon} /></span>
    {/if}
  {/each}
  <span class="car-fact-weight">{facts.weight}</span>
</span>

<style>
  .car-facts {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  .car-fact {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--space-1);
  }

  .car-fact-weight {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
