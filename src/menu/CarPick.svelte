<script lang="ts">
  import type { CarShelf } from "../car/car-pick";
  import Button from "./ui/Button.svelte";
  import ClassBadge from "./ui/ClassBadge.svelte";
  import Dialog from "./ui/Dialog.svelte";
  import SectionHead from "./ui/SectionHead.svelte";
  import Tile from "./ui/Tile.svelte";

  interface Props {
    title: string;
    limit: string;
    shelves: readonly CarShelf[];
    onpick: (code: string | null) => void;
  }

  let { title, limit, shelves, onpick }: Props = $props();

  let open = $state(true);
  let picked: string | null = null;

  export function close() {
    picked = null;
    open = false;
  }

  function pick(code: string) {
    picked = code;
    open = false;
  }
</script>

<Dialog bind:open {title} subtitle={limit} onclose={() => onpick(picked)}>
  <div class="list">
    {#each shelves as shelf (shelf.head)}
      <div class="shelf">
        <SectionHead eyebrow={shelf.head} />
        <ol>
          {#each shelf.choices as choice (choice.code)}
            <li>
              {#snippet why()}{choice.blocked}{/snippet}
              <Tile title={choice.title} meta={choice.sub} disabled={choice.blocked !== null} reason={choice.blocked ? why : undefined} onclick={() => pick(choice.code)}>
                <span class="meta">
                  <ClassBadge rating={choice.rating} />
                  {#if choice.fitted}<span class="why">Fitted</span>{/if}
                </span>
              </Tile>
            </li>
          {/each}
        </ol>
      </div>
    {/each}
  </div>

  {#snippet actions()}
    <Button variant="quiet" onclick={() => (open = false)}>Back</Button>
  {/snippet}
</Dialog>

<style>
  .list {
    display: grid;
    gap: var(--space-5);
  }

  .shelf {
    display: grid;
    gap: var(--space-3);
  }

  ol {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .why {
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
  }
</style>
