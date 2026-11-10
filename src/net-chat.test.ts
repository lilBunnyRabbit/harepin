/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Room, joinRoom } from "trystero";
import { LEGACY_PROTOCOL, Net, PROTOCOL, type RaceEvent, type Sender } from "./net";

type Receive = (data: unknown, meta: { peerId: string }) => void;

interface Sent {
  name: string;
  data: unknown;
  target: unknown;
}

function fake_room() {
  const receivers = new Map<string, Receive>();
  const sent: Sent[] = [];
  const room = {
    onPeerJoin: null as ((peer: string) => void) | null,
    onPeerLeave: null as ((peer: string) => void) | null,
    makeAction: (name: string) => ({
      send: (data: unknown, options?: { target?: unknown }) => {
        sent.push({ name, data, target: options?.target });
        return Promise.resolve();
      },
      set onMessage(fn: Receive) {
        receivers.set(name, fn);
      },
    }),
  };
  const join = (() => room as unknown as Room) as typeof joinRoom;
  const hear = (name: string, data: unknown, peerId: string) => receivers.get(name)?.(data, { peerId });
  return { room, join, hear, sent };
}

let rooms = 0;
function net_on(seed: number) {
  const fake = fake_room();
  const net = new Net(`test-${rooms++}`, seed, "Me", null, 1, "0.11.0", fake.join);
  return { net, ...fake };
}

const car = (seed: number, name: string) => ({ name, seed, w: 1, t: 1, p: [0, 0, 0], q: [0, 0, 0, 1], v: [0, 0, 0], steer: 0, brake: false, best: null });

test("chat comes from any room peer: on another map, or before its first car packet, still rate-limited", () => {
  const { net, room, hear } = net_on(7);
  const heard: string[] = [];
  net.on_chat((name, text) => heard.push(`${name}: ${text}`));
  const say = (peerId: string, text: string) => hear("chat", { text, t: 1 }, peerId);
  room.onPeerJoin?.("fresh");
  say("fresh", "hi");
  hear("car", car(99, "Far"), "far");
  say("far", "over here");
  hear("car", car(7, "Near"), "near");
  say("near", "same map");
  say("near", "too fast");
  expect(heard).toEqual(["Player: hi", "Far: over here", "Near: same map"]);
});

test("race events come from any same-map peer, past the car cap too, never from another map", () => {
  const { net, hear } = net_on(7);
  const heard: Sender[] = [];
  net.on_event((_event, from) => heard.push(from));
  for (let i = 0; i < 20; i++) hear("car", car(7, `P${i}`), `p${String(i).padStart(2, "0")}`);
  hear("car", car(99, "Far"), "far");
  expect(net.remotes.has("p19")).toBe(false);
  const request: RaceEvent = { kind: "request", laps: 1, route: "circuit" };
  for (const id of ["p00", "p19", "far", "stranger"]) hear("event", request, id);
  expect(heard.map((s) => [s.id, s.name])).toEqual([
    ["p00", "P0"],
    ["p19", "P19"],
  ]);
});

test("a joining peer gets a hello, and only that peer", () => {
  const { room, sent } = net_on(7);
  room.onPeerJoin?.("new");
  expect(sent).toEqual([{ name: "hello", data: { protocol: PROTOCOL, version: "0.11.0", world: 1, seed: 7 }, target: "new" }]);
});

test("a peer's protocol is what its hello said; none, a bad one or a departed peer reads as legacy", () => {
  const { net, room, hear } = net_on(7);
  hear("hello", { protocol: 3, version: "0.12.0", world: 1, seed: 7 }, "newer");
  hear("hello", { protocol: "2", version: "0.12.0", world: 1, seed: 7 }, "bad");
  expect(net.protocol_of("newer")).toBe(3);
  expect(net.hellos.get("newer")?.version).toBe("0.12.0");
  expect(net.protocol_of("bad")).toBe(LEGACY_PROTOCOL);
  expect(net.protocol_of("old")).toBe(LEGACY_PROTOCOL);
  room.onPeerLeave?.("newer");
  expect(net.protocol_of("newer")).toBe(LEGACY_PROTOCOL);
});

test("same-browser tabs swap hellos without WebRTC; a legacy tab is greeted once", async () => {
  const room = `test-${rooms++}`;
  const tab = new BroadcastChannel(`harepin:${room}`);
  const heard: unknown[] = [];
  tab.onmessage = (event: MessageEvent<unknown>) => heard.push(event.data);
  const offline = (() => {
    throw new Error("no WebRTC");
  }) as typeof joinRoom;
  const net = new Net(room, 7, "Me", null, 1, "0.11.0", offline);
  const hello = { protocol: PROTOCOL, version: "0.11.0", world: 1, seed: 7 };
  tab.postMessage({ kind: "hello", id: "newer", data: { ...hello, protocol: 2 } });
  tab.postMessage({ kind: "car", id: "old", data: car(7, "Old") });
  tab.postMessage({ kind: "car", id: "old", data: car(7, "Old") });
  await new Promise((resolve) => setTimeout(resolve, 50));
  tab.close();
  expect(net.status).toBe("local only");
  expect(net.protocol_of("newer")).toBe(2);
  expect(heard).toEqual([
    { kind: "hello", id: net.id, data: hello },
    { kind: "hello", id: net.id, data: hello, to: "newer" },
    { kind: "hello", id: net.id, data: hello, to: "old" },
  ]);
});
