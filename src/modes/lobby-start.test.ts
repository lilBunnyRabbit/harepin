/// <reference types="bun" />
import { expect, test } from "bun:test";
import { start_lobby } from "./lobby-start";

function steps(log: string[]) {
  return {
    restart: async () => {
      await Promise.resolve();
      log.push("restart");
    },
    reset: () => log.push("reset"),
    race: (route: string) => log.push(`race ${route}`),
  };
}

test("a route race is the last thing to place the car", async () => {
  const log: string[] = [];
  await start_lobby("sprint-1", steps(log));
  await new Promise((done) => setTimeout(done, 0));
  expect(log).toEqual(["reset", "race sprint-1"]);
});

test("the circuit restarts on its spawn", async () => {
  const log: string[] = [];
  await start_lobby("circuit", steps(log));
  expect(log).toEqual(["restart"]);
});
