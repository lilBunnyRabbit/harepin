import "../../../scripts/fake-dom";
import { describe, expect, test } from "bun:test";
import { render } from "svelte/server";
import type { Server } from "../../net/directory";
import type { Player } from "../../net/players";
import type { Menu } from "../page";
import { DEFAULT_SETTINGS } from "../prefs";
import type { MenuState } from "../ui/menu-state.svelte";
import OnlineGames from "./OnlineGames.svelte";
import OnlinePlayers from "./OnlinePlayers.svelte";
import OnlineRace from "./OnlineRace.svelte";
import RoomPage from "./RoomPage.svelte";

const game = (over: Partial<Server> = {}): Server => ({
  key: "g1",
  peer: "p1",
  here: false,
  room: "tuesday",
  seed: 42,
  host: "Ana",
  players: 2,
  version: "1.0.0",
  locked: false,
  ...over,
} as Server);

const player = (over: Partial<Player> = {}): Player => ({
  key: "g1#0",
  name: "Ana",
  country: null,
  tier: null,
  racing: false,
  ping: 40,
  you: false,
  game: game(),
  ...over,
});

function setup(host: object) {
  const menu = { host: { version: "1.0.0", kind: "island", race_routes: [], ...host }, state: () => DEFAULT_SETTINGS } as unknown as Menu;
  const live = { prefs: DEFAULT_SETTINGS, live: <T>(read: () => T) => read(), set: () => {} } as unknown as MenuState;
  return { menu, live };
}

describe("online cards", () => {
  test("players say why the list is empty, and the games card stays out", () => {
    const props = setup({ players_online: () => [], servers: () => [], servers_status: () => "offline", password_failed: () => false });
    expect(render(OnlinePlayers, { props }).body).toContain("No other games found. Invite links still work.");
    expect(render(OnlineGames, { props }).body).not.toContain("Games running");
  });

  test("a player row tags you, offers Join elsewhere and shows the ping", () => {
    const props = setup({
      players_online: () => [player({ key: "me", name: "Me", you: true, ping: null, game: game({ here: true }) }), player({ ping: 40 })],
      servers_status: () => "online",
      version: "1.0.0",
    });
    const html = render(OnlinePlayers, { props }).body;
    expect(html).toContain("You");
    expect(html).toContain("Join");
    expect(html).toContain("40 ms");
  });

  test("a game on another version says so instead of Join", () => {
    const props = setup({ servers: () => [game({ version: "0.9.0" })], password_failed: () => false });
    const html = render(OnlineGames, { props }).body;
    expect(html).toContain("Different version");
    expect(html).not.toContain(">Join<");
  });

  test("a map without routes says it is free roam", () => {
    const props = setup({ race_left_out: () => false, race_busy: () => false, race_ready: () => false, lobby_record: () => "", ready_status: () => ({ total: 1 }) });
    expect(render(OnlineRace, { props }).body).toContain("No races on this map");
  });

  test("the new room form labels every field", () => {
    const { menu, live } = setup({});
    const html = render(RoomPage, { props: { menu, live, shown: true } }).body;
    for (const label of ["Room name", "Password", "Map code", "Create room"]) expect(html).toContain(label);
  });
});
