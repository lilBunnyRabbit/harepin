/// <reference types="bun" />
import { expect, mock, test } from "bun:test";

interface Action {
  send: () => Promise<void>;
  onMessage: ((data: unknown, meta: { peerId: string }) => void) | null;
}

const actions = new Map<string, Action>();
const room = {
  onPeerJoin: (_peer: string) => {},
  makeAction: (name: string) => {
    const action: Action = { send: () => Promise.resolve(), onMessage: null };
    actions.set(name, action);
    return action;
  },
};
mock.module("trystero", () => ({ selfId: "self", joinRoom: () => room }));

const { Net } = await import("./net");

const car = (seed: number, name: string) => ({ name, seed, w: 1, t: 1, p: [0, 0, 0], q: [0, 0, 0, 1], v: [0, 0, 0], steer: 0, brake: false, best: null });

test("chat comes from any room peer: on another map, or before its first car packet, still rate-limited", () => {
  const net = new Net("lobby", 7, "Me", null, 1);
  const heard: string[] = [];
  net.on_chat = (name, text) => heard.push(`${name}: ${text}`);
  const say = (peerId: string, text: string) => actions.get("chat")?.onMessage?.({ text, t: 1 }, { peerId });
  room.onPeerJoin("fresh");
  say("fresh", "hi");
  actions.get("car")?.onMessage?.(car(99, "Far"), { peerId: "far" });
  say("far", "over here");
  actions.get("car")?.onMessage?.(car(7, "Near"), { peerId: "near" });
  say("near", "same map");
  say("near", "too fast");
  expect(heard).toEqual(["Player: hi", "Far: over here", "Near: same map"]);
});
