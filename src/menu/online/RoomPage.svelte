<script lang="ts">
  import { PASSWORD_LENGTH, clean_password, locked_name, save_lock } from "../../net/directory";
  import { ROOM_LENGTH, clean_room } from "../../net/room-name";
  import { parse_seed } from "../../net/seed";
  import { world_query } from "../../world/world-pick";
  import { bare_enter } from "../drive-picks";
  import MenuFrame from "../MenuFrame.svelte";
  import Card from "../ui/Card.svelte";
  import PrimaryAction from "../ui/PrimaryAction.svelte";
  import Row from "../ui/Row.svelte";
  import type { PageProps } from "../ui/svelte-page.svelte";
  import TextField from "../ui/TextField.svelte";
  import { invalid, random_seed } from "../widgets";
  import { clear_validity, field } from "./join";
  import { NEW_ROOM_PAGE } from "./rooms";

  let { menu, shown }: PageProps = $props();

  let sheet = $state<HTMLFormElement>();

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
    const picked = seed.trim() ? parse_seed(seed.trim()) : random_seed();
    if (picked === null) return invalid(field(form, "seed"), "A whole number from 0 to 4294967295");
    const named = lock === null ? room : locked_name(room);
    save_lock(named, lock === null ? null : { password: lock, asked: false });
    menu.go(world_query(named, picked, menu.host.kind));
  }

  function key(event: KeyboardEvent) {
    if (!shown || !bare_enter(event)) return;
    event.preventDefault();
    sheet?.requestSubmit();
  }
</script>

<svelte:window onkeydown={key} />

<MenuFrame {menu} id={NEW_ROOM_PAGE} eyebrow="Online" title="New room" season={false} veil={0.55} note="Leave it all empty for a random code and map.">
  <form class="room-form" bind:this={sheet} onsubmit={create}>
    <Card list label="New room">
      <Row label="Room name" help="Empty for a random code" stack>
        {#snippet control()}
          <span class="room-input"><TextField aria-label="Room name" name="room" maxlength={ROOM_LENGTH} placeholder="Random code" bind:value={name} oninput={clear_validity} /></span>
        {/snippet}
      </Row>
      <Row label="Password" help="Only players with the password can join; the room shows a lock" stack>
        {#snippet control()}
          <span class="room-input">
            <TextField aria-label="Password" name="password" type="password" maxlength={PASSWORD_LENGTH} placeholder="None" bind:value={password} oninput={clear_validity} />
          </span>
        {/snippet}
      </Row>
      <Row label="Map code" help="Empty for a random map" stack>
        {#snippet control()}
          <span class="room-input">
            <TextField aria-label="Map code" name="seed" inputmode="numeric" maxlength={10} placeholder="Random" mono bind:value={seed} oninput={clear_validity} />
          </span>
        {/snippet}
      </Row>
    </Card>
  </form>
  {#snippet primary()}
    <PrimaryAction tone="online" onclick={() => sheet?.requestSubmit()}>Create room</PrimaryAction>
  {/snippet}
</MenuFrame>

<style>
  .room-form {
    display: grid;
    grid-template-columns: minmax(0, 40rem);
    justify-content: center;
    align-content: start;
    height: 100%;
  }

  .room-input {
    display: flex;
    width: 26ch;
    max-width: 100%;
  }

  .room-input > :global(*) {
    flex: 1;
  }

  @media (max-height: 500px) {
    .room-form {
      height: auto;
    }
  }
</style>
