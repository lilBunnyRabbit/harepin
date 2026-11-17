<script lang="ts">
  import KeyButton from "./KeyButton.svelte";

  interface Props {
    to: string;
    onclick: () => void;
  }

  let { to, onclick }: Props = $props();
</script>

<KeyButton class="ui-back" data-nav variant="quiet" keys={{ key: "Esc", pad: "B", touch: "icon-back" }} {onclick}>{to}</KeyButton>

<style>
  :global(:root .ui-back) {
    --key-pad: 1.3em;
  }

  @media (max-height: 500px) {
    :global(:root .ui-back) {
      --key-pad: 1.2em;
      --key-pad-cap: 0.8em;
      gap: 0.3em;
    }
  }
</style>
