<script lang="ts">
  import type { Menu } from "../page";

  interface Props {
    menu: Menu;
  }

  let { menu }: Props = $props();
</script>

<div class="set-changes" {@attach (node) => void node.append(menu.host.changelog())}></div>

<style>
  .set-changes {
    display: contents;
  }
</style>
