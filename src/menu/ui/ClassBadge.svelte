<script lang="ts">
  import { CLASS_LABELS, type Rating } from "../../car/pi";

  interface Props {
    rating: Rating;
    size?: "md" | "lg";
  }

  let { rating, size = "md" }: Props = $props();

  const letter = $derived(CLASS_LABELS[rating.class]);
</script>

<span class="ui-class-badge" data-class={rating.class} data-size={size} aria-label={`Class ${letter}, PI ${rating.pi}`}>
  <b class="ui-letter">{letter}</b>
  <span class="ui-pi">{rating.pi}</span>
</span>

<style>
  /* The edge is --dim, not a hairline: a faint rounded edge on a fractional pixel vanished beside the crisp divider and
     read as a cut-off badge. */
  .ui-class-badge {
    --class-edge: var(--dim);
    display: inline-flex;
    flex: none;
    align-items: stretch;
    overflow: hidden;
    border: 1.5px solid var(--class-edge);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--foreground);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.5;
    white-space: nowrap;
  }

  [data-class="x"] {
    --class-edge: var(--primary);
  }

  [data-size="lg"] {
    font-size: var(--text-lg);
  }

  .ui-letter,
  .ui-pi {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-1);
  }

  .ui-letter {
    min-width: 2.4ch;
    border-right: 1.5px solid var(--class-edge);
    background: var(--panel-raised);
  }
</style>
