<script lang="ts">
  import Icon from "../ui/Icon.svelte";
  import { drivers, type RoomGroup } from "./rooms";

  interface Props {
    group: RoomGroup;
    detail?: string;
  }

  let { group, detail }: Props = $props();
</script>

<span class="room-head">
  <span class="room-head-text">
    <b class="room-head-name">
      {#if group.here}<span class="room-head-own">Your room</span>{/if}
      <span class="room-head-clip">{group.name} · {group.map}</span>
      {#if group.game.locked}<span class="room-head-lock" role="img" aria-label="Locked"><Icon name="icon-lock" /></span>{/if}
    </b>
    {#if detail}<small class="room-head-detail">{detail}</small>{/if}
  </span>
  <span class="room-head-state" data-racing={group.racing ? "" : undefined}>{group.racing ? "Racing" : "Roaming"}</span>
  <span class="room-head-count" role="img" aria-label={drivers(group.count)}><Icon name="icon-people" />{group.count}</span>
</span>

<style>
  .room-head {
    --icon-size: 1.1em;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--gap);
    min-width: 0;
    min-height: var(--row-h);
    padding: var(--gap-sm) var(--gap-md);
    border-radius: var(--radius-sm);
    background: var(--row);
  }

  .room-head-text {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .room-head-name {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    min-width: 0;
    font-weight: 700;
    white-space: nowrap;
  }

  .room-head-own {
    flex: none;
    color: var(--secondary);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .room-head-clip {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .room-head-lock {
    display: flex;
    flex: none;
    color: var(--dim);
  }

  .room-head-detail {
    overflow: hidden;
    color: var(--dim);
    font-size: var(--type-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .room-head-state,
  .room-head-count {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    color: var(--dim);
    font-size: var(--type-small);
    font-weight: 700;
    white-space: nowrap;
  }

  .room-head-state::before {
    content: "";
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
    background: currentcolor;
  }

  .room-head-state[data-racing] {
    color: var(--warning);
  }

  .room-head-count {
    min-width: 3em;
    justify-content: flex-end;
    color: var(--foreground);
    font-family: var(--font-mono);
  }
</style>
