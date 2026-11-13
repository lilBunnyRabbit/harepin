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
    ongarage?: () => void;
  }

  let { title, limit, shelves, onpick, ongarage }: Props = $props();

  let open = $state(true);
  let picked: string | null = null;
  let garage = false;

  export function close() {
    picked = null;
    open = false;
  }

  function pick(code: string) {
    picked = code;
    open = false;
  }

  function to_garage() {
    picked = null;
    garage = true;
    open = false;
  }

  function closed() {
    onpick(picked);
    if (garage) ongarage?.();
  }
</script>

<Dialog bind:open {title} wide onclose={closed}>
  <div class="list">
    <p class="limit">{limit}</p>
    <div class="classes">
      {#each shelves as shelf (shelf.class)}
        <div class="shelf">
          <SectionHead eyebrow={shelf.head} />
          <ol>
            {#each shelf.choices as choice (choice.code)}
              <li>
                {#snippet why()}{choice.blocked}{/snippet}
                <Tile title={choice.title} meta={choice.sub || undefined} clamp={2} disabled={choice.blocked !== null} reason={choice.blocked ? why : undefined} onclick={() => pick(choice.code)}>
                  <span class="meta" class:lift={!choice.blocked}>
                    <ClassBadge rating={choice.rating} />
                    {#if choice.own}<span class="own">Your car</span>{/if}
                    {#if choice.recommended}<span class="rec">Recommended</span>{/if}
                    {#if choice.fitted}<span class="why">Fitted</span>{/if}
                  </span>
                </Tile>
              </li>
            {/each}
          </ol>
        </div>
      {/each}
    </div>
  </div>

  {#snippet actions()}
    {#if ongarage}<Button variant="quiet" onclick={to_garage}>Garage</Button>{/if}
    <Button variant="quiet" onclick={() => (open = false)}>Back</Button>
  {/snippet}
</Dialog>

<style>
  .list {
    display: grid;
    gap: var(--space-5);
  }

  /* Classes sit side by side where the dialog is wide, and stack on a phone. */
  .classes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
    align-items: start;
    gap: var(--space-5) var(--space-4);
  }

  @media (orientation: landscape) and (max-height: 500px), (max-width: 700px) {
    .classes {
      grid-template-columns: minmax(0, 1fr);
    }
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
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  /* A blocked car's row sits in the tile's foot, which already has this gap above it. */
  .lift {
    margin-top: var(--space-1);
  }

  .limit {
    justify-self: start;
    margin: 0;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--primary);
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--primary) 16%, transparent);
    color: var(--foreground);
    font-size: var(--text-lg);
    font-weight: 700;
  }

  .rec {
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--primary);
    color: var(--on-primary);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .own {
    padding: 0 var(--space-2);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-sm);
    color: var(--foreground);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .why {
    color: var(--set-dim);
    font-size: var(--text-sm);
    font-weight: 600;
  }
</style>
