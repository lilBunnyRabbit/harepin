<script lang="ts">
  import { tick } from "svelte";
  import { current_theme, find_saved, load_saved_themes, store_saved_themes, without_saved } from "../../theme/theme";
  import Badge from "../ui/Badge.svelte";
  import Button from "../ui/Button.svelte";
  import SettingRow from "./SettingRow.svelte";
  import { reload_without } from "./sections";

  let saved = $state.raw(load_saved_themes());
  let list: HTMLElement | undefined = $state();
  const in_use = $derived(find_saved(saved, current_theme())?.name ?? null);

  async function remove(name: string) {
    if (!store_saved_themes(without_saved(load_saved_themes(), name))) return;
    if (name === in_use) return reload_without("theme");
    saved = load_saved_themes();
    await tick();
    list?.querySelector("button")?.focus();
  }
</script>

<div class="set-saved" bind:this={list}>
  {#each saved as { name } (name)}
    <SettingRow label={name} help={name === in_use ? "The theme you're using. Delete it and the game goes back to Brand Dark." : "Delete it to remove it from the Theme list."} custom>
      <span class="set-saved-end">
        {#if name === in_use}<Badge tone="primary">In use</Badge>{/if}
        <Button size="sm" onclick={() => remove(name)}>Delete</Button>
      </span>
    </SettingRow>
  {:else}
    <p class="set-empty">No themes yet. Make one with Make your own theme.</p>
  {/each}
</div>

<style>
  .set-saved {
    display: contents;
  }

  .set-saved-end {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .set-empty {
    margin: 0;
    padding: var(--space-4);
    color: var(--set-dim);
    font-size: var(--text-md);
  }
</style>
