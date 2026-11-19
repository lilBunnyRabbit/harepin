import { expect, test } from "bun:test";
import { DEFAULT_BUILD, DEFAULT_PARTS } from "../car/build";
import { car_shelves } from "../car/car-pick";
import { PRESETS } from "../car/presets";
import { FRAME_CUPS, STARTER_FRAMES, body_price, first_body, frame_locks, frame_of, lock_line, owned_frames } from "./frames";
import { CUPS } from "./series-seasons";
import { BASE_CAR, parse_wallet } from "./wallet";

test("the starter frames are Hatch, Coupe, Tsumuji and the free Bus; the base car is on one", () => {
  expect([...STARTER_FRAMES].sort()).toEqual(["bus", "coupe", "hatch", "tsumuji"]);
  expect(STARTER_FRAMES).toContain(frame_of(BASE_CAR));
});

test("six cups, each keeping its own frame, the loaner it lends; Fujin stays the Legend reward", () => {
  expect(CUPS.map((cup) => cup.loaner)).toEqual(["rally", "muscle", "sajin", "raijin", "sturm", "formula"]);
  for (const cup of CUPS) {
    expect(cup.reward.car).toBe(cup.loaner);
    expect(FRAME_CUPS[frame_of(cup.loaner!)]).toBe(cup);
  }
  expect(lock_line("rally")).toBe("Finish the Rally Trial to own it");
  expect(lock_line("muscle")).toBe("Finish the Muscle Cup to own it");
  expect(lock_line("fujin")).toBe("Win the Legend final to own it");
  expect(lock_line("bus")).toBeNull();
});

test("a fresh player locks every body on a cup or Legend frame; on a starter only the extra body, for sale", () => {
  const locks = frame_locks([BASE_CAR]);
  for (const car of ["hatch", "coupe", "tsumuji", "bus"] as const) expect(locks[car]).toBeUndefined();
  expect(locks.kaze).toBe("Buy it for 15,000 cr");
  expect(locks.muscle).toBe("Finish the Muscle Cup to own it");
  expect(locks.orkan).toBe(locks.muscle);
  expect(locks.hagel).toBe("Finish the Rally Trial to own it");
  expect(locks.fujin).toBe("Win the Legend final to own it");
});

test("a cup gives its frame's first body; the frame's other bodies are bought, then open", () => {
  for (const cup of CUPS) expect(first_body(frame_of(cup.loaner!))).toBe(cup.loaner!);
  expect(owned_frames(["rally"]).has("rally")).toBe(true);
  const locks = frame_locks(["rally"]);
  expect(locks.rally).toBeUndefined();
  expect(locks.hagel).toBe("Buy it for 25,000 cr");
  expect(locks.sturm).toBeDefined();
  expect(frame_locks(["rally", "hagel"]).hagel).toBeUndefined();
});

test("extra bodies price by their frame's tier; a first body or a Legend frame is not sold", () => {
  expect(body_price("kaze")).toBe(15_000);
  expect(body_price("hagel")).toBe(25_000);
  expect(body_price("orkan")).toBe(25_000);
  for (const car of ["hatch", "rally", "muscle", "fujin", "bus", "formula"] as const) expect(body_price(car)).toBeNull();
});

test("a stored wallet keeps what it owns; junk drops out and the base car stays", () => {
  const wallet = parse_wallet({ id: "you", credits: 7500, cars: ["rally", "sturm", "warp-drive", 3] });
  expect(wallet.cars).toEqual([BASE_CAR, "rally", "sturm"]);
  const locks = frame_locks(wallet.cars);
  expect(locks.rally).toBeUndefined();
  expect(locks.sturm).toBeUndefined();
  expect(locks.formula).toBeDefined();
});

test("the picker greys a locked frame's cars with how to own them, and lets any car in where none is locked", () => {
  const limit = { cap: null, car_sized_only: false };
  const locked = car_shelves({ ...DEFAULT_BUILD, parts: { ...DEFAULT_PARTS } }, [], PRESETS, { ...limit, locked: frame_locks([BASE_CAR]) }).flatMap((s) => s.choices);
  expect(locked.find((c) => c.build.car === "formula")?.blocked).toBe("Finish the Formula Cup to own it");
  expect(locked.find((c) => c.build.car === "coupe")?.blocked).toBeNull();
  const free = car_shelves(DEFAULT_BUILD, [], PRESETS, limit).flatMap((s) => s.choices);
  expect(free.every((c) => c.blocked === null)).toBe(true);
});
