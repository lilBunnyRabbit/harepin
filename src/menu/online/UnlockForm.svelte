<script lang="ts">
  import { PASSWORD_LENGTH, clean_password, type Announce } from "../../net/directory";
  import type { Menu } from "../page";
  import Button from "../ui/Button.svelte";
  import TextField from "../ui/TextField.svelte";
  import { invalid } from "../widgets";
  import { clear_validity, field, join_game } from "./join";

  interface Props {
    menu: Menu;
    target: Announce;
    oncancel: () => void;
  }

  let { menu, target, oncancel }: Props = $props();

  let secret = $state("");

  function submit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    event.preventDefault();
    const password = clean_password(secret);
    if (password === null) return invalid(field(event.currentTarget, "password"), "Enter the room password");
    join_game(menu, target, password);
  }
</script>

<form class="unlock" onsubmit={submit}>
  <TextField
    label={`Password for ${target.room}`}
    name="password"
    type="password"
    maxlength={PASSWORD_LENGTH}
    bind:value={secret}
    oninput={clear_validity}
    {@attach (input: HTMLInputElement) => input.focus()}
  />
  <div class="unlock-actions">
    <Button type="submit" variant="primary">Join</Button>
    <Button variant="quiet" onclick={oncancel}>Cancel</Button>
  </div>
</form>

<style>
  .unlock {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--set-soft);
  }

  .unlock-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
