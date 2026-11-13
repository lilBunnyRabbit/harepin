<script lang="ts">
  import type { TierView } from "../career/career-model";
  import type { RewardKind } from "../career/rewards";
  import RewardMark from "./RewardMark.svelte";

  interface Props {
    views: TierView[];
  }

  let { views }: Props = $props();

  const KINDS: readonly RewardKind[] = ["paint", "decal", "badge"];
</script>

<section class="tc-case" aria-label="Trophy case">
  <h3>Trophy case</h3>
  <table>
    <tbody>
      {#each views as view (view.tier.id)}
        <tr data-state={view.state}>
          <th scope="row">{view.tier.name}</th>
          {#each KINDS as kind (kind)}
            {@const reward = view.rewards.find((r) => r.kind === kind)}
            <td>
              {#if reward}<span title={`${reward.name}: ${reward.got ? "earned" : reward.how}`}><RewardMark {reward} index={view.index} /></span>{/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  .tc-case {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-5) var(--space-6);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
  }

  h3 {
    margin: 0;
    font-size: var(--text-xl);
  }

  table {
    border-collapse: collapse;
  }

  th {
    padding-right: var(--space-3);
    font-size: var(--text-md);
    font-weight: 600;
    text-align: left;
  }

  td {
    padding: var(--space-1);
    text-align: center;
  }

  tr[data-state="locked"] th {
    color: var(--set-dim);
  }
</style>
