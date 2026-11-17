<script lang="ts">
  import type { Build } from "../car/build";
  import type { CarId } from "../car/cars";
  import { StillView, still_build } from "./still-build";

  interface Props {
    car: CarId;
    /** The car as built, in its own paint and parts; without it the stock car in its still paint. */
    build?: Build;
    /** Index into the aero kits. */
    aero?: number;
    /** Faces the other way. */
    flip?: boolean;
    /** The car's outline in one flat token, never the lit car. */
    outline?: boolean;
    label?: string;
  }

  let { car, build, aero = 0, flip = false, outline = false, label }: Props = $props();

  let src = $state<string>();

  $effect(() => {
    let live = true;
    const drawn = build ?? still_build(car, aero);
    const view = outline ? StillView.PROFILE : StillView.QUARTER;
    // Loaded here, never at import: the renderer and the theme it reads stay out of a server render.
    import("./car-still")
      .then(({ car_still }) => car_still(drawn, view))
      .then(
        (url) => {
          if (live) src = url;
        },
        (error) => console.warn("still: no picture of", drawn.car, error),
      );
    return () => {
      live = false;
    };
  });
</script>

<span class="still" data-flip={flip || undefined} data-outline={outline || undefined} data-ready={src ? "" : undefined} role={label ? "img" : undefined} aria-label={label}>
  {#if outline}
    <span class="still-outline" style:--still={src ? `url(${src})` : undefined}></span>
  {:else if src}
    <img {src} alt="" />
  {/if}
</span>

<style>
  .still {
    display: block;
    aspect-ratio: 16 / 9;
    min-width: 0;
  }

  [data-flip] {
    scale: -1 1;
  }

  img,
  .still-outline {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* A slot of another shape shows the whole car, never a cut or stretched one. */
  img {
    object-fit: contain;
  }

  /* A profile is long and low: its slot keeps the picture's floor and drops the empty sky over the roof. */
  [data-outline] {
    aspect-ratio: 8 / 3;
  }

  .still-outline {
    background: color-mix(in oklch, var(--foreground) 32%, transparent);
    mask: var(--still, none) bottom / 100% auto no-repeat;
  }

  .still:not([data-ready]) .still-outline {
    visibility: hidden;
  }
</style>
