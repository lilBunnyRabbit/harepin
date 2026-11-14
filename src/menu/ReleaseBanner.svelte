<script lang="ts">
  import type { Story } from "./release-story";
  import CarStill from "./CarStill.svelte";
  import Badge from "./ui/Badge.svelte";

  interface Props {
    story: Story;
  }

  let { story }: Props = $props();

  const [left, right] = $derived(story.banner);
</script>

<div class="banner">
  {#if story.tease}<div class="banner-tease"><CarStill car={story.tease} outline /></div>{/if}
  {#if left}<div class="banner-car banner-left"><CarStill car={left} flip /></div>{/if}
  {#if right}<div class="banner-car banner-right"><CarStill car={right} /></div>{/if}
  <span class="banner-tag"><Badge>Big update</Badge></span>
</div>

<style>
  /* One floor line: both cars stand on it and face in, the locked car's outline stands behind them, between the two. */
  .banner {
    position: relative;
    aspect-ratio: 3 / 1;
    overflow: hidden;
    background: var(--panel-well);
  }

  .banner-tease,
  .banner-car {
    position: absolute;
    bottom: 0;
  }

  .banner-tease {
    left: 19%;
    width: 62%;
    bottom: 26%;
  }

  .banner-car {
    width: 40%;
    bottom: -4%;
  }

  .banner-left {
    left: 3%;
  }

  .banner-right {
    right: 3%;
  }

  .banner-tag {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    display: flex;
  }

  @media (max-height: 500px) {
    .banner {
      aspect-ratio: 9 / 2;
    }

    .banner-car {
      width: 30%;
    }

    .banner-left {
      left: 12%;
    }

    .banner-right {
      right: 12%;
    }

    .banner-tease {
      left: 31%;
      width: 38%;
    }
  }
</style>
