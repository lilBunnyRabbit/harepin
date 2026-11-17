import "../../../scripts/fake-dom";
import { describe, expect, test } from "bun:test";
import { render } from "svelte/server";
import type { Server } from "../../net/directory";
import type { Player } from "../../net/players";
import type { ReadyStatus } from "../../net/ready";
import { CarPicker } from "../car-pick.svelte";
import type { Menu } from "../page";
import { DEFAULT_SETTINGS } from "../prefs";
import type { MenuState } from "../ui/menu-state.svelte";
import { meet_note } from "./meet";
import MeetPage from "./MeetPage.svelte";
import OnlinePage from "./OnlinePage.svelte";
import RoomPage from "./RoomPage.svelte";
import RoomsPage from "./RoomsPage.svelte";
import { OTHER_VERSION, joinable, room_groups, totals, totals_text } from "./rooms";

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

const ready = (over: Partial<ReadyStatus> = {}): ReadyStatus => ({ names: [], waiting: ["you"], total: 1, next: null, electing: false, left_out: false, ...over });

const HOST = {
  version: "1.0.0",
  kind: "island",
  room: "lobby",
  seed: 3,
  code: null,
  race_routes: [],
  name: () => "Me",
  map_name: () => "Island · Harwar",
  net_status: () => "online",
  players: () => 1,
  peers: () => 0,
  version_peers: () => ({ older: 0, newer: 0 }),
  servers_status: () => "online",
  password_failed: () => false,
  players_online: () => [],
  race_busy: () => false,
  race_ready: () => false,
  race_left_out: () => false,
  ready_status: () => ready(),
  meet_drivers: () => [{ id: "me", name: "Me", country: "SI", car: null, you: true, ready: false }],
  online_count: () => 1,
  runs: { stars: 0 },
  lobby_record: () => "",
  browse_servers: () => {},
  career: { stars: {} },
  car_code: () => "",
};

function setup(host: object) {
  const menu = { host: { ...HOST, ...host }, state: () => DEFAULT_SETTINGS, up_of: () => "Online", sync: () => {} } as unknown as Menu;
  const live = { prefs: DEFAULT_SETTINGS, live: <T>(read: () => T) => read(), set: () => {} } as unknown as MenuState;
  return { menu, live, shown: true };
}

const meet = (host: object) => ({ ...setup(host), picker: new CarPicker() });

const here = game({ key: "own", here: true, room: "lobby", players: 2 });
const racing = game({ key: "g2", room: "owl", players: 3, racing: true });
const everyone = [
  player({ key: "own#0", name: "Me", you: true, ping: null, game: here }),
  player({ key: "own#1", name: "Mika", ping: null, game: here }),
  player({ key: "g1#0", name: "Ana" }),
  player({ key: "g2#0", name: "Aiko", racing: true, game: racing }),
  player({ key: "g3#0", name: "Old", game: game({ key: "g3", room: "past", version: "0.9.0" }) }),
];
const routes = [{ id: "circuit", name: "Harbour loop", length: 4200, closed: true }];

describe("rooms", () => {
  test("players group by room, this room first, each with its state and count", () => {
    const groups = room_groups(everyone, "1.0.0");
    expect(groups.map((group) => [group.name, group.here, group.racing, group.count, group.players.length])).toEqual([
      ["Open road", true, false, 2, 2],
      ["tuesday", false, false, 2, 1],
      ["owl", false, true, 3, 1],
      ["past", false, false, 2, 1],
    ]);
    expect(groups[2].more).toBe(2);
    expect(totals_text(totals(groups))).toBe("9 players · 4 rooms · 1 racing");
  });

  test("only another room on this build can be joined", () => {
    const groups = room_groups(everyone, "1.0.0");
    expect(joinable(groups).map((one) => one.name)).toEqual(["Ana", "Aiko"]);
    expect(groups[3].blocked).toBe(OTHER_VERSION);
  });
});

describe("online pages", () => {
  test("Online groups players by room and the one primary joins the first by name", () => {
    const html = render(OnlinePage, { props: setup({ players_online: () => everyone, online_count: () => 9 }) }).body;
    expect(html).toContain("9 online");
    for (const text of ["Your room", "Island · Harwar", "Players online", "9 players · 4 rooms · 1 racing", "with you", "Racing", "Roaming", 'aria-label="Join Aiko"', OTHER_VERSION, "and 2 more"]) expect(html).toContain(text);
    expect(html).toContain("Join Ana");
    expect(html).toContain("Joining moves you to");
    expect(html.match(/data-tone="online"/g)?.length).toBe(1);
  });

  test("alone, Online says why the list is empty and the primary falls back", () => {
    const empty = render(OnlinePage, { props: setup({ servers_status: () => "offline" }) }).body;
    expect(empty).toContain("No other rooms found. Invite links still work.");
    expect(empty).not.toContain(">Join<");
    expect(render(OnlinePage, { props: setup({ race_routes: routes }) }).body).toContain("Race the drivers in your room.");
  });

  test("a failed room password offers another try on the room tile", () => {
    const locked = game({ key: "own", here: true, room: "den~ab12", locked: true });
    const html = render(OnlinePage, { props: setup({ room: "den~ab12", password_failed: () => true, players_online: () => [player({ key: "own#0", you: true, game: locked })] }) }).body;
    expect(html).toContain("Wrong password");
  });

  test("Other rooms lists each room once with its host, and blocks another version", () => {
    const html = render(RoomsPage, { props: setup({ players_online: () => everyone }) }).body;
    for (const text of ["Other rooms", "Host Ana · 40 ms", "other version", "Join tuesday"]) expect(html).toContain(text);
    expect(html).not.toContain("Your room");
    expect(render(RoomsPage, { props: setup({}) }).body).toContain("No other rooms right now");
  });

  test("the new room form labels every field", () => {
    const html = render(RoomPage, { props: setup({}) }).body;
    for (const label of ["Room name", "Password", "Map code", "Create room"]) expect(html).toContain(label);
  });
});

describe("race meet", () => {
  test("the note counts who is ready, and says when you race alone or sit out", () => {
    expect(meet_note(ready({ names: ["Mika"], waiting: ["you"], total: 2 }), false, false)).toBe("1 of 2 ready. It starts when everyone is.");
    expect(meet_note(ready(), false, false)).toBe("You're alone here: it starts at once.");
    expect(meet_note(ready({ electing: true }), false, false)).toBe("Looking for players in the room…");
    expect(meet_note(ready({ total: 2 }), false, true)).toBe("This car can't race here");
  });

  test("a map without routes says it is free roam, with no primary", () => {
    const html = render(MeetPage, { props: meet({}) }).body;
    expect(html).toContain("No races on this map");
    expect(html).not.toContain('data-tone="online"');
  });

  test("Ready is the one primary in the online tone; alone it names the route", () => {
    const status = ready({ names: ["Mika"], waiting: ["you"], total: 2, next: { route: "circuit", laps: 3 } });
    const mika = { id: "p2", name: "Mika", country: null, car: null, you: false, ready: true };
    const html = render(MeetPage, { props: meet({ race_routes: routes, ready_status: () => status, meet_drivers: () => [...HOST.meet_drivers(), mika] }) }).body;
    for (const text of ["Harbour loop · 3 laps", "1/2", "Not ready", "Me · you", "Mika", "Start without waiting", "Open slot", "Change car", ">Ready<"]) expect(html).toContain(text);
    expect(html.match(/data-tone="online"/g)?.length).toBe(1);
    const alone = render(MeetPage, { props: meet({ race_routes: routes }) }).body;
    expect(alone).toContain("Race Harbour loop");
    expect(alone).not.toContain("Start without waiting");
  });

  test("a running race takes a hold to leave", () => {
    const html = render(MeetPage, { props: meet({ race_routes: routes, race_busy: () => true }) }).body;
    expect(html).toContain("Hold to leave race");
    expect(html).not.toContain("Start without waiting");
  });
});
