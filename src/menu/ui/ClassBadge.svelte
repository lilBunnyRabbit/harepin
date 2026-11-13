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
