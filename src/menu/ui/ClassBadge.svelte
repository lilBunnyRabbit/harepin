<script lang="ts">
  import { CLASS_LABELS, type CarClass, type Rating } from "../../car/pi";

  // A car shows its rating; an event's limit shows the top class it lets in, with "max" where the PI goes.
  type Props = ({ rating: Rating; cap?: never } | { cap: CarClass; rating?: never }) & { size?: "md" | "lg" };

  const props: Props = $props();

  const rating = $derived(props.rating);
  const cls = $derived(props.rating ? props.rating.class : props.cap);
  const letter = $derived(CLASS_LABELS[cls]);
</script>

<span class="ui-class-badge" data-class={cls} data-size={props.size ?? "md"} aria-label={rating ? `Class ${letter}, PI ${rating.pi}` : `Class ${letter} or lower`}>
  <b class="ui-letter">{letter}</b>
  <span class="ui-pi">{rating ? rating.pi : "max"}</span>
</span>

<style>
  /* A plate: the class letter on a block of the class colour, the PI beside it. Sized in em, so it follows the line it sits in. */
  .ui-class-badge {
    --class-fill: var(--tertiary);
    --class-ink: var(--on-primary);
    display: inline-flex;
    flex: none;
    align-items: stretch;
    height: 1.7em;
    overflow: hidden;
    border: 1px solid var(--class-fill);
    border-radius: var(--radius-xs);
    background: var(--deep);
    color: var(--foreground);
    font: 700 0.74em / 1 var(--font-mono);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  [data-size="lg"] {
    font-size: 1em;
  }

  [data-class="c"] {
    --class-fill: var(--primary);
  }

  [data-class="b"] {
    --class-fill: var(--accent);
    --class-ink: var(--on-accent);
  }

  [data-class="a"] {
    --class-fill: var(--error);
  }

  [data-class="s1"] {
    --class-fill: var(--secondary);
    --class-ink: var(--on-secondary);
  }

  [data-class="s2"] {
    --class-fill: var(--info);
  }

  [data-class="x"] {
    --class-fill: var(--cottontail);
    --class-ink: var(--on-cottontail);
  }

  .ui-letter,
  .ui-pi {
    display: grid;
    place-items: center;
    padding: 0 0.5em;
  }

  .ui-letter {
    background: var(--class-fill);
    color: var(--class-ink);
  }
</style>
