<script lang="ts">
  import MenuFrame from "../MenuFrame.svelte";
  import Card from "../ui/Card.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import { CHANGES } from "./sections";

  let { menu }: PageProps = $props();
</script>

<MenuFrame {menu} id={CHANGES} eyebrow="Settings" title="What's new" season={false} veil={0.6} note={`You have v${menu.host.version}`}>
  <div class="changes">
    <Card class="changes-card" label="Release notes">
      <div class="changes-body" {@attach (node) => void node.append(menu.host.changelog())}></div>
    </Card>
  </div>
</MenuFrame>

<style>
  .changes {
    display: grid;
    justify-items: center;
    height: 100%;
    min-height: 0;
  }

  .changes > :global(.changes-card) {
    width: min(860px, 100%);
    max-height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
  }

  @media (max-height: 500px) {
    .changes {
      height: auto;
    }

    .changes > :global(.changes-card) {
      max-height: none;
      overflow: visible;
    }
  }
</style>
