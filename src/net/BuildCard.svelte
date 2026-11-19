<script lang="ts">
  import CarFactsLine from "../menu/CarFactsLine.svelte";
  import Button from "../menu/ui/Button.svelte";
  import ClassBadge from "../menu/ui/ClassBadge.svelte";
  import type { BuildSummary } from "./build-link";

  interface Props {
    build: BuildSummary;
    onuse: (code: string) => void;
  }

  let { build, onuse }: Props = $props();
</script>

<div class="chat-build" role="group" aria-label="{build.car} build">
  <div class="chat-build-head">
    <span class="chat-build-car">{build.car}</span>
    <ClassBadge rating={build.rating} />
  </div>
  <CarFactsLine facts={build.facts} words />
  <span class="chat-build-parts">{build.parts.length ? build.parts.join(" · ") : "Stock parts"}</span>
  <Button size="sm" variant="primary" icon="icon-slot-engine" onclick={() => onuse(build.code)}>Use build</Button>
</div>

<style>
  .chat-build {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--gap-xs);
    max-width: 88%;
    padding: var(--gap-sm) var(--gap-md);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: var(--panel-raised);
    color: var(--foreground);
  }

  .chat-build-head {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    font-size: var(--type-body);
  }

  .chat-build-car {
    font-weight: 700;
  }

  .chat-build-parts {
    color: var(--dim);
    font-size: var(--type-small);
    line-height: 1.4;
  }

  .chat-build :global(.ui-button) {
    margin-top: var(--gap-xs);
  }
</style>
