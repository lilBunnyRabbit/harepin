/// <reference types="bun" />
import { afterEach, expect, spyOn, test } from "bun:test";
import { COUNTDOWN_MS, Lobby, NOT_THIS_CAR, RACE_RUNNING, SITTING_OUT, lobby_routes, race_laps } from "./lobby";
import { leader_of, type Net, type RaceEvent, type Sender } from "./net";
import { READY_RESEND_MS, READY_TTL_MS, type ReadyMsg } from "./ready";

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
  readonly remotes = new Map<string, Sender>();
  readonly same_map = new Map<string, number>();
  readonly sent: RaceEvent[] = [];
  readonly readies: ReadyMsg[] = [];
  settling = false;
  electing = false;
  private readonly listeners = new Set<(event: RaceEvent, from: Sender) => void>();
  private readonly ready_listeners = new Set<(msg: ReadyMsg, from: Sender) => void>();

  constructor(readonly id: string) {}

  get leader_id(): string {
    return leader_of(this.id, this.same_map.keys());
  }

  peer(id: string, offset = 0): Sender {
    const sender = { id, name: id, offset };
    this.remotes.set(id, sender);
    this.same_map.set(id, 0);
    return sender;
  }

  send_event(event: RaceEvent) {
    this.sent.push(event);
  }

  on_event(fn: (event: RaceEvent, from: Sender) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  hear(event: RaceEvent, from: Sender) {
    for (const fn of this.listeners) fn(event, from);
  }

  name_of(id: string) {
    return id;
  }

  send_ready(msg: ReadyMsg) {
    this.readies.push(msg);
  }

  on_ready(fn: (msg: ReadyMsg, from: Sender) => void) {
    this.ready_listeners.add(fn);
    return () => this.ready_listeners.delete(fn);
  }

  hear_ready(msg: ReadyMsg, from: Sender) {
    for (const fn of this.ready_listeners) fn(msg, from);
  }
}

const started: Lobby[] = [];
afterEach(() => {
  for (const lobby of started.splice(0)) lobby.stop();
});

function lobby_on(id: string) {
  const net = new FakeNet(id);
  const lobby = new Lobby(net as unknown as Net, ROUTES, "test", null);
  lobby.start();
  started.push(lobby);
  return { net, lobby };
}

const start = (race: number, start_at: number, route = "circuit"): RaceEvent => ({ kind: "start", race, laps: 1, start_at, route });

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

const READY: ReadyMsg = { ready: true, laps: 2, route: "circuit" };

test("a lone player who readies just starts", () => {
  const { net, lobby } = lobby_on("m");
  lobby.set_ready({ laps: 2, route: "circuit" });
  lobby.tick(performance.now());
  expect(net.readies).toEqual([READY]);
  expect(lobby.state).toMatchObject({ kind: "countdown", laps: 2 });
  expect(net.sent[0]).toMatchObject({ kind: "start", laps: 2 });
  expect(lobby.ready).toBe(false);
});

test("the leader starts its own call once every present peer is ready; un-readying or a late leaver recounts", () => {
  const { net, lobby } = lobby_on("a");
  const z = net.peer("z");
  const y = net.peer("y");
  lobby.set_ready({ laps: 2, route: "circuit" });
  net.hear_ready({ ready: true, laps: 5, route: "circuit" }, z);
  lobby.tick(performance.now());
  expect(lobby.state.kind).toBe("idle");
  expect(lobby.ready_status(performance.now())).toEqual({ names: ["you", "z"], waiting: ["y"], total: 3, next: { laps: 2, route: "circuit" }, electing: false, left_out: false });
  net.hear_ready(READY, y);
  net.hear_ready({ ready: false }, z);
  lobby.tick(performance.now());
  expect(lobby.state.kind).toBe("idle");
  net.remotes.delete("z");
  net.same_map.delete("z");
  lobby.tick(performance.now());
  expect(lobby.state).toMatchObject({ kind: "countdown", laps: 2 });
  expect(lobby.ready_status(performance.now()).names).toEqual([]);
});

test("a follower never starts on all-ready; it resends its ready on the beat and stops once the race starts", () => {
  const { net, lobby } = lobby_on("m");
  const a = net.peer("a");
  lobby.set_ready({ laps: 2, route: "circuit" });
  net.hear_ready(READY, a);
  const now = performance.now();
  lobby.tick(now);
  lobby.tick(now + READY_RESEND_MS / 2);
  expect(lobby.state.kind).toBe("idle");
  expect(net.sent).toEqual([]);
  lobby.tick(now + READY_RESEND_MS);
  expect(net.readies).toEqual([READY, READY]);
  net.hear(start(1, performance.now() + COUNTDOWN_MS), a);
  expect(lobby.state.kind).toBe("countdown");
  lobby.tick(now + READY_TTL_MS);
  expect(net.readies.length).toBe(2);
});

test("a cancel right after a beat is resent until the TTL, and readying is refused while a race runs", () => {
  const { net, lobby } = lobby_on("m");
  const a = net.peer("a");
  const now = performance.now();
  lobby.set_ready({ laps: 2, route: "circuit" });
  lobby.tick(now);
  lobby.tick(now + READY_RESEND_MS);
  lobby.set_ready(null, now + READY_RESEND_MS + 1);
  lobby.tick(now + READY_RESEND_MS + 1);
  for (let beat = 2; beat <= 6; beat++) lobby.tick(now + READY_RESEND_MS * beat + 1);
  const cancels = net.readies.slice(2);
  expect(net.readies.slice(0, 2)).toEqual([READY, READY]);
  expect(cancels.every((m) => !m.ready)).toBe(true);
  expect(cancels.length).toBe(1 + READY_TTL_MS / READY_RESEND_MS);
  net.hear(start(1, performance.now() + COUNTDOWN_MS), a);
  lobby.set_ready({ laps: 2, route: "circuit" });
  expect(lobby.ready).toBe(false);
});

test("a new pick while ready is sent at once and is what the leader starts", () => {
  const { net, lobby } = lobby_on("a");
  const z = net.peer("z");
  lobby.set_ready({ laps: 2, route: "circuit" });
  lobby.tick(performance.now());
  lobby.set_ready({ laps: 5, route: "circuit" });
  lobby.tick(performance.now());
  expect(net.readies).toEqual([READY, { ready: true, laps: 5, route: "circuit" }]);
  net.hear_ready(READY, z);
  lobby.tick(performance.now());
  expect(lobby.state).toMatchObject({ kind: "countdown", laps: 5 });
});

const DUNES = lobby_routes([
  { id: "circuit", closed: true, length: 4500, excludes: ["bus"] },
  { id: "sprint-1", closed: false, length: 1800 },
]);

function driving(id: string, initial: string) {
  let car = initial;
  const net = new FakeNet(id);
  const lobby = new Lobby(net as unknown as Net, DUNES, "test", null);
  const notices: string[] = [];
  lobby.car = () => car;
  lobby.on_notice = (notice) => notices.push(notice);
  lobby.start();
  started.push(lobby);
  return { net, lobby, notices, swap: (next: string) => (car = next) };
}

test("a peer whose car the route leaves out sits the leader's start out with a notice", () => {
  const { net, lobby, notices } = driving("m", "bus");
  const a = net.peer("a");
  let starts = 0;
  lobby.on_start = () => starts++;
  lobby.set_ready({ laps: 2, route: "sprint-1" });
  net.hear_ready({ ready: true, laps: 2, route: "circuit" }, a);
  expect(lobby.ready_status(performance.now()).left_out).toBe(true);
  net.hear(start(1, performance.now() + COUNTDOWN_MS), a);
  expect(lobby.state.kind).toBe("idle");
  expect(lobby.ready).toBe(false);
  expect(starts).toBe(0);
  expect(notices).toEqual([SITTING_OUT]);
  net.hear(start(2, performance.now() + COUNTDOWN_MS, "sprint-1"), a);
  expect(lobby.state).toMatchObject({ kind: "countdown", route: "sprint-1" });
});

test("a left-out car can't call or ready for that route; any other car can", () => {
  const bus = driving("a", "bus");
  bus.lobby.call(2, "circuit");
  bus.lobby.set_ready({ laps: 2, route: "circuit" });
  expect(bus.lobby.state.kind).toBe("idle");
  expect(bus.lobby.ready).toBe(false);
  expect(bus.net.sent).toEqual([]);
  expect(bus.notices).toEqual([NOT_THIS_CAR, NOT_THIS_CAR]);

  const coupe = driving("a", "coupe");
  coupe.lobby.call(2, "circuit");
  expect(coupe.lobby.state).toMatchObject({ kind: "countdown", route: "circuit" });
  expect(coupe.notices).toEqual([]);
});

test("a leader in a left-out car still starts a peer's request, and sits it out", () => {
  const { net, lobby, notices } = driving("a", "bus");
  net.hear({ kind: "request", laps: 2, route: "circuit" }, net.peer("z"));
  expect(net.sent[0]).toMatchObject({ kind: "start", route: "circuit" });
  expect(lobby.state.kind).toBe("idle");
  expect(notices).toEqual([SITTING_OUT]);

  const sent = net.sent.length;
  net.hear({ kind: "request", laps: 1, route: "sprint-1" }, net.peer("y"));
  lobby.call(1, "sprint-1");
  expect(net.sent.length).toBe(sent);
  expect(notices).toEqual([SITTING_OUT, RACE_RUNNING]);
  const start_at = (net.sent[0] as { start_at: number }).start_at;
  const clock = spyOn(performance, "now").mockReturnValue(start_at + 2 * (DUNES.get("circuit")?.min_lap ?? 0));
  try {
    lobby.call(1, "sprint-1");
    expect(lobby.state).toMatchObject({ kind: "countdown", route: "sprint-1" });
  } finally {
    clock.mockRestore();
  }
});

test("swapping into a left-out car mid-race leaves the race; any other swap doesn't", () => {
  const { net, lobby, notices, swap } = driving("m", "coupe");
  const a = net.peer("a");
  net.hear(start(1, performance.now() + COUNTDOWN_MS, "sprint-1"), a);
  swap("bus");
  expect(lobby.car_changed()).toBe(false);
  lobby.leave();
  swap("coupe");
  net.hear(start(2, performance.now() + COUNTDOWN_MS), a);
  expect(lobby.car_changed()).toBe(false);
  swap("bus");
  expect(lobby.car_changed()).toBe(true);
  expect(lobby.state.kind).toBe("idle");
  expect(notices).toEqual([SITTING_OUT]);
});
