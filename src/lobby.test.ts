/// <reference types="bun" />
import { expect, spyOn, test } from "bun:test";
import { COUNTDOWN_MS, Lobby, lobby_routes, race_laps } from "./lobby";
import { leader_of, type Net, type RaceEvent, type Remote } from "./net";

test("lobby routes: laps only on a closed route, the plausible lap from its length", () => {
  const routes = lobby_routes([
    { id: "circuit", closed: true, length: 4500 },
    { id: "street-1", closed: false, length: 1800 },
  ]);
  expect([...routes.keys()]).toEqual(["circuit", "street-1"]);
  const circuit = routes.get("circuit");
  const street = routes.get("street-1");
  if (!circuit || !street) throw new Error("routes missing");
  expect(race_laps(circuit, 3)).toBe(3);
  expect(race_laps(street, 3)).toBe(1);
  expect(street.min_lap).toBeCloseTo(20_000, 0);
});

const ROUTES = lobby_routes([{ id: "circuit", closed: true, length: 4500 }]);
const MIN_LAP = ROUTES.get("circuit")?.min_lap ?? 0;

class FakeNet {
  readonly name = "Me";
  readonly remotes = new Map<string, Remote>();
  readonly same_map = new Map<string, number>();
  readonly sent: RaceEvent[] = [];
  settling = false;
  on_event: ((event: RaceEvent, from: Remote) => void) | null = null;

  constructor(readonly id: string) {}

  get leader_id(): string {
    return leader_of(this.id, this.same_map.keys());
  }

  peer(id: string, offset = 0): Remote {
    const remote = { id, latest: { name: id }, snapshots: [], offset, seen: 0 } as unknown as Remote;
    this.remotes.set(id, remote);
    this.same_map.set(id, 0);
    return remote;
  }

  send_event(event: RaceEvent) {
    this.sent.push(event);
  }

  display_name(remote: Remote): string {
    return remote.latest.name;
  }

  hear(event: RaceEvent, from: Remote) {
    this.on_event?.(event, from);
  }
}

function lobby_on(id: string) {
  const net = new FakeNet(id);
  const lobby = new Lobby(net as unknown as Net, ROUTES, "test", null);
  lobby.start();
  return { net, lobby };
}

const start = (race: number, start_at: number): RaceEvent => ({ kind: "start", race, laps: 1, start_at, route: "circuit" });

test("only the leader's start counts, and the leader is the lowest same-map id even past the car cap", () => {
  const { net, lobby } = lobby_on("m");
  const z = net.peer("z");
  net.same_map.set("a", 0);
  net.hear(start(1, performance.now() + COUNTDOWN_MS), z);
  expect(lobby.state.kind).toBe("idle");
  const a = net.peer("a");
  net.hear(start(2, performance.now() + COUNTDOWN_MS), a);
  expect(lobby.state).toMatchObject({ kind: "countdown", race: 2 });
});

test("a start is kept only inside its window, shifted by the sender's clock offset", () => {
  const { net, lobby } = lobby_on("m");
  const a = net.peer("a", 500);
  net.hear(start(1, performance.now() - 2000), a);
  expect(lobby.state.kind).toBe("idle");
  net.hear(start(2, performance.now() + 20_000), a);
  expect(lobby.state.kind).toBe("idle");
  const at = performance.now() + COUNTDOWN_MS;
  net.hear(start(3, at), a);
  expect(lobby.state).toMatchObject({ kind: "countdown", race: 3 });
  if (lobby.state.kind === "countdown") expect(lobby.state.go).toBeCloseTo(at + 500, 0);
});

test("a request starts the race only on the leader", () => {
  const follower = lobby_on("m");
  follower.net.peer("a");
  follower.net.hear({ kind: "request", laps: 2, route: "circuit" }, follower.net.peer("z"));
  expect(follower.lobby.state.kind).toBe("idle");
  expect(follower.net.sent).toEqual([]);

  const leader = lobby_on("a");
  leader.net.hear({ kind: "request", laps: 2, route: "circuit" }, leader.net.peer("z"));
  expect(leader.lobby.state).toMatchObject({ kind: "countdown", laps: 2 });
  expect(leader.net.sent[0]).toMatchObject({ kind: "start", laps: 2 });
});

test("a newcomer asks instead of electing itself while peers' maps are unknown", () => {
  const { net, lobby } = lobby_on("a");
  net.settling = true;
  lobby.call(3);
  expect(lobby.state.kind).toBe("idle");
  expect(net.sent).toEqual([{ kind: "request", laps: 3, route: "circuit" }]);
  net.settling = false;
  lobby.call(3);
  expect(lobby.state.kind).toBe("countdown");
});

test("finishes count only for this race and only when physically possible", () => {
  const { net, lobby } = lobby_on("a");
  const z = net.peer("z");
  lobby.call(1);
  if (lobby.state.kind !== "countdown") throw new Error("race not started");
  const { race, go } = lobby.state;
  lobby.update(go);
  const elapsed = MIN_LAP + 1000;
  const clock = spyOn(performance, "now").mockReturnValue(go + elapsed);
  try {
    net.hear({ kind: "finish", race: race + 1, time: MIN_LAP + 1 }, z);
    net.hear({ kind: "finish", race, time: MIN_LAP - 1 }, z);
    net.hear({ kind: "finish", race, time: elapsed + 3000 }, z);
    expect(lobby.finishers).toEqual([]);
    net.hear({ kind: "finish", race, time: MIN_LAP }, z);
    net.hear({ kind: "finish", race, time: MIN_LAP + 10 }, z);
    expect(lobby.finishers).toEqual([{ id: "z", name: "z", time: MIN_LAP, you: false }]);
  } finally {
    clock.mockRestore();
  }
});

test("a request nobody answers tells the caller once; a start in time doesn't", () => {
  const { net, lobby } = lobby_on("m");
  const a = net.peer("a");
  let unanswered = 0;
  lobby.on_unanswered = () => unanswered++;
  lobby.call(3);
  expect(net.sent).toEqual([{ kind: "request", laps: 3, route: "circuit" }]);
  const now = performance.now();
  lobby.update(now + 1000);
  expect(unanswered).toBe(0);
  lobby.update(now + 5000);
  lobby.update(now + 6000);
  expect(unanswered).toBe(1);

  lobby.call(3);
  net.hear(start(1, performance.now() + COUNTDOWN_MS), a);
  lobby.update(performance.now() + 2000);
  lobby.leave();
  lobby.update(performance.now() + 5000);
  expect(unanswered).toBe(1);
});
