<script lang="ts">
  interface Props {
    name: string;
    flip?: boolean;
  }

  let { name, flip = false }: Props = $props();
</script>

<svg class="ui-icon" class:ui-flip={flip} aria-hidden="true"><use href={`#${name}`} /></svg>

<style>
  .ui-icon {
    flex: none;
    width: var(--icon-size);
    height: var(--icon-size);
  }

  .ui-flip {
    rotate: 180deg;
  }
</style>
