/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Room } from "trystero";
import { Link } from "./channel";
import { RateLimit } from "./rate-limit";

interface Sent {
  data: unknown;
  target: unknown;
}

function fake_room() {
  const handlers = new Map<string, (data: unknown, meta: { peerId: string }) => void>();
  const sent = new Map<string, Sent[]>();
  const room = {
    makeAction: (name: string) => {
      const action = {
        send: (data: unknown, options?: { target?: unknown }) => {
          sent.set(name, [...(sent.get(name) ?? []), { data, target: options?.target }]);
          return Promise.resolve();
        },
        set onMessage(fn: (data: unknown, meta: { peerId: string }) => void) {
          handlers.set(name, fn);
        },
      };
      return action;
    },
  };
  const hear = (name: string, data: unknown, peerId: string) => handlers.get(name)?.(data, { peerId });
  return { room: room as unknown as Room, hear, sent };
}

const text = (raw: unknown) => (typeof raw === "string" ? raw : null);

test("a channel fans one sanitized message out to every subscriber, never its own", () => {
  const { room, hear } = fake_room();
  const link = new Link("self", new BroadcastChannel("test-fanout"), room);
  const ping = link.channel("ping", text);
  const a: string[] = [];
  const b: string[] = [];
  ping.subscribe((t, from) => a.push(`${from}:${t}`));
  const stop = ping.subscribe((t) => b.push(t));
  hear("ping", "hi", "x");
  hear("ping", 5, "x");
  hear("ping", "echo", "self");
  stop();
  hear("ping", "later", "y");
  expect(a).toEqual(["x:hi", "y:later"]);
  expect(b).toEqual(["hi"]);
});

test("a limited channel rate-limits each sender, and forgets one that left", () => {
  const { room, hear } = fake_room();
  const link = new Link("self", new BroadcastChannel("test-limit"), room);
  const heard: string[] = [];
  link.channel("ping", text, () => new RateLimit()).subscribe((t, from) => heard.push(`${from}:${t}`));
  hear("ping", "1", "x");
  hear("ping", "2", "x");
  hear("ping", "1", "y");
  link.forget("x");
  hear("ping", "3", "x");
  expect(heard).toEqual(["x:1", "y:1", "x:3"]);
});

test("send goes to every peer or one target", () => {
  const { room, sent } = fake_room();
  const ping = new Link("self", new BroadcastChannel("test-send"), room).channel("ping", text);
  ping.send("all");
  ping.send("one", "x");
  expect(sent.get("ping")).toEqual([
    { data: "all", target: undefined },
    { data: "one", target: "x" },
  ]);
});

test("same-browser tabs hear each other over the BroadcastChannel, a targeted send only its tab", async () => {
  const tab = (id: string) => new Link(id, new BroadcastChannel("test-tabs"), null).channel("ping", text);
  const [a, b, c] = [tab("a"), tab("b"), tab("c")];
  const heard: string[] = [];
  b.subscribe((t, from) => heard.push(`b<${from}:${t}`));
  c.subscribe((t, from) => heard.push(`c<${from}:${t}`));
  a.send("all");
  a.send("just b", "b");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(heard.sort()).toEqual(["b<a:all", "b<a:just b", "c<a:all"]);
});

test("a refused sender spends none of its rate limit", () => {
  const { room, hear } = fake_room();
  const link = new Link("self", new BroadcastChannel("test-accept"), room);
  const known = new Set<string>();
  const heard: string[] = [];
  link.channel("ping", text, () => new RateLimit(), (id) => known.has(id)).subscribe((t, from) => heard.push(`${from}:${t}`));
  hear("ping", "early", "x");
  known.add("x");
  hear("ping", "1", "x");
  hear("ping", "2", "x");
  expect(heard).toEqual(["x:1"]);
});
