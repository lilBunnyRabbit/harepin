<script lang="ts">
  import type { TierView } from "../career/career-model";

  interface Props {
    here: TierView;
    trophies: number;
  }

  let { here, trophies }: Props = $props();
</script>

<section class="dn-done" aria-label="Career complete">
  <h3>Career complete</h3>
  <p>{here.tier.name} rank and all {trophies} trophies won.</p>
</section>

<style>
  .dn-done {
    display: grid;
    gap: var(--space-3);
  }

  h3 {
    margin: 0;
    font-size: var(--text-xl);
  }

  p {
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-md);
  }
</style>
