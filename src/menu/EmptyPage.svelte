<script lang="ts">
  import MenuFrame from "./MenuFrame.svelte";
  import type { PageProps } from "./ui/svelte-page.svelte";

  interface Props extends PageProps {
    id: string;
  }

  let { menu, id }: Props = $props();
</script>

<MenuFrame {menu} {id} floor />
