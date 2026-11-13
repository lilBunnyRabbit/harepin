import "../../../scripts/fake-dom";
import { describe, expect, test } from "bun:test";
import { render } from "svelte/server";
import type { Server } from "../../net/directory";
import type { Player } from "../../net/players";
import type { Menu } from "../page";
import { DEFAULT_SETTINGS } from "../prefs";
import type { MenuState } from "../ui/menu-state.svelte";
import SeasonBar from "../runs/SeasonBar.svelte";
import DailyBoard from "./DailyBoard.svelte";
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

  test("the daily board ranks today's times and says when there are none", () => {
    const runs = { today: "2026-11-13", own_daily: { k: "k", ms: 61_000 } };
    const rows = [
      { name: "Ana", ms: 59_000, you: false, here: true },
      { name: "Me", ms: 61_000, you: true, here: true },
      { name: "Cy", ms: 70_000, you: false, here: false },
    ];
    const html = render(DailyBoard, { props: setup({ runs, daily_board: () => rows }) }).body;
    for (const text of ["1. Ana", "0:59.000", "2. Me", "You", "Seen earlier today", "Run today's daily"]) expect(html).toContain(text);
    const empty = render(DailyBoard, { props: setup({ runs: { ...runs, own_daily: null }, daily_board: () => [] }) }).body;
    expect(empty).toContain("No times yet today.");
  });

  test("the season bar names its steps and the next one", () => {
    const html = render(SeasonBar, { props: { stars: 31, season: "2026-10-26", today: "2026-11-13" } }).body;
    for (const text of ["Season 1", "31 ★", "Accent tint", "S1 Regular", "Next: Info tint at 45 ★"]) expect(html).toContain(text);
    expect(render(SeasonBar, { props: { stars: 500, season: "2026-10-26", today: "2026-11-13", compact: true } }).body).toContain("Every step reached");
  });
});
