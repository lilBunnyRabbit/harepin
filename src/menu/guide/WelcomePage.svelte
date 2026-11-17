<script lang="ts">
  import { current_theme } from "../../theme/theme";
  import { bare_enter } from "../drive-picks";
  import { mark_drive } from "../prefs-store";
  import { reload_without } from "../settings-tab/sections";
  import KeyLink from "../ui/KeyLink.svelte";
  import PageFrame from "../ui/PageFrame.svelte";
  import PrimaryAction from "../ui/PrimaryAction.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import WelcomeName from "./WelcomeName.svelte";
  import WelcomeSetup from "./WelcomeSetup.svelte";

  const VEIL = 0.72;

  interface Props extends PageProps {
    seen: () => void;
  }

  let { menu, live, shown, seen }: Props = $props();

  const booted = current_theme();

  // A new theme reaches the 3D world only on a load: that load lands on the road, as Drive says.
  function drive() {
    if (current_theme() === booted) return menu.close();
    seen();
    mark_drive();
    reload_without("theme");
  }

  let setup = $state(false);

  export function back(): boolean {
    if (!setup) return false;
    setup = false;
    return true;
  }

  const next = () => (setup ? drive() : (setup = true));

  function key(event: KeyboardEvent) {
    if (!shown || event.defaultPrevented || !bare_enter(event)) return;
    event.preventDefault();
    next();
  }
</script>

<svelte:window onkeydown={key} />

{#snippet links()}
  {#if !setup}<KeyLink onclick={drive}>Skip set up</KeyLink>{/if}
{/snippet}

{#snippet primary()}
  <PrimaryAction onclick={next}>{setup ? "Drive" : "Next: Set up"}</PrimaryAction>
{/snippet}

<PageFrame
  veil={VEIL}
  eyebrow={`First run · ${setup ? 2 : 1} of 2`}
  title={setup ? "Set up" : "Welcome to Harepin"}
  back={setup ? { to: "Name", go: () => (setup = false) } : undefined}
  {links}
  note={setup ? "All of it is in Settings whenever you want to change it." : undefined}
  {primary}
>
  {#if setup}
    <WelcomeSetup {live} />
  {:else}
    <WelcomeName {menu} {live} />
  {/if}
</PageFrame>
