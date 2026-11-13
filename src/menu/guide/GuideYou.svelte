<script lang="ts">
  import { untrack } from "svelte";
  import { random_name } from "../guide-rules";
  import IconButton from "../ui/IconButton.svelte";
  import SectionHead from "../ui/SectionHead.svelte";
  import TextField from "../ui/TextField.svelte";
  import GuideLayout from "./GuideLayout.svelte";
  import GuideShot from "./GuideShot.svelte";
  import type { GuideState } from "./guide.svelte";

  interface Props {
    guide: GuideState;
  }

  let { guide }: Props = $props();

  const fallback = $derived(guide.host.name());
  let name = $state(untrack(() => guide.prefs.name ?? ""));
  const shown = $derived(name.trim() || fallback);

  let saved = untrack(() => guide.prefs.name);

  function commit() {
    const next = name.trim() || null;
    if (next === saved) return;
    saved = next;
    guide.set("name", next);
  }

  function roll() {
    name = random_name(shown);
    saved = name;
    guide.set("name", name);
  }

  $effect(() => commit);
</script>

<GuideLayout title="Welcome to Harepin" lede="A small driving game: a mainland to roam, mini maps for quick runs, friends a link away. First, a name.">
  {#snippet copy()}
    <div class="guide-field">
      <SectionHead eyebrow="Your name" />
      <div class="guide-name">
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
      <small class="guide-help">Others see it above your car. Change it any time from the name chip in the menu.</small>
    </div>
  {/snippet}
  {#snippet visual()}
    <GuideShot picture={guide.host.picture(guide.host.kind).src} tag={shown} />
  {/snippet}
</GuideLayout>

<style>
  .guide-field {
    display: grid;
    gap: var(--space-2);
  }

  .guide-name {
    --control-h: var(--control-h-lg);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .guide-name > :global(.ui-field) {
    flex: 1;
  }

  .guide-help {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    text-wrap: pretty;
  }
</style>
