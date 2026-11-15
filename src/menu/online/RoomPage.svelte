<script lang="ts">
  import { PASSWORD_LENGTH, clean_password, locked_name, save_lock } from "../../net/directory";
  import { ROOM_LENGTH, clean_room } from "../../net/room-name";
  import { parse_seed } from "../../net/seed";
  import { world_query } from "../../world/world-pick";
  import Button from "../ui/Button.svelte";
  import Row from "../ui/Row.svelte";
  import RowList from "../ui/RowList.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import TextField from "../ui/TextField.svelte";
  import { invalid, random_seed } from "../widgets";
  import { clear_validity, field } from "./join";

  let { menu }: PageProps = $props();

  let name = $state("");
  let password = $state("");
  let seed = $state("");

  const random_code = () => Math.random().toString(36).slice(2, 8);

  function create(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    event.preventDefault();
    const form = event.currentTarget;
    const room = name.trim() ? clean_room(name) : random_code();
    if (room === null) return invalid(field(form, "room"), `Up to ${ROOM_LENGTH} characters`);
    const lock = password ? clean_password(password) : null;
    if (password && lock === null) return invalid(field(form, "password"), `Up to ${PASSWORD_LENGTH} characters`);
    const map = seed.trim() ? parse_seed(seed.trim()) : random_seed();
    if (map === null) return invalid(field(form, "seed"), "A whole number from 0 to 4294967295");
    const named = lock === null ? room : locked_name(room);
    save_lock(named, lock === null ? null : { password: lock, asked: false });
    menu.go(world_query(named, map, menu.host.kind));
  }
</script>

<form class="room-form" onsubmit={create}>
  <RowList divided label="Room">
    <Row label="Room name" help="Empty for a random code">
      {#snippet control()}
        <span class="room-input"><TextField aria-label="Room name" name="room" maxlength={ROOM_LENGTH} placeholder="Random code" bind:value={name} oninput={clear_validity} /></span>
      {/snippet}
    </Row>
    <Row label="Password" help="Locks the room: it shows a lock and a short code on its name, and only players with the password can connect">
      {#snippet control()}
        <span class="room-input">
          <TextField aria-label="Password" name="password" type="password" maxlength={PASSWORD_LENGTH} placeholder="None" bind:value={password} oninput={clear_validity} />
        </span>
      {/snippet}
    </Row>
    <Row label="Map code" help="Empty for a random map">
      {#snippet control()}
        <span class="room-input">
          <TextField aria-label="Map code" name="seed" inputmode="numeric" maxlength={10} placeholder="Random" mono bind:value={seed} oninput={clear_validity} />
        </span>
      {/snippet}
    </Row>
  </RowList>
  <div class="room-submit">
    <p class="room-lead">Everything is optional: leave it all empty for a random code and map.</p>
    <Button type="submit" variant="primary" size="lg">Create room</Button>
  </div>
</form>

<style>
  .room-form {
    display: grid;
  }

  .room-input {
    display: flex;
    width: 26ch;
  }

  .room-input > :global(*) {
    flex: 1;
  }

  .room-submit {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-4);
    border-top: 1px solid var(--set-line);
  }

  .room-lead {
    flex: 1;
    min-width: 0;
    margin: 0;
    color: var(--set-dim);
    font-size: var(--text-md);
    line-height: 1.45;
    text-wrap: pretty;
  }

  @media (max-width: 600px) {
    .room-input {
      width: 18ch;
    }
  }
</style>
