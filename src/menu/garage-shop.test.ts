import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { DECALS, DEFAULT_BUILD, DEFAULT_PARTS, NEONS, build_code } from "../car/build";
import { part_price } from "../career/prices";
import type { PartPick } from "../career/wallet";
import { own_parts } from "./garage-items";
import { Wallet } from "../career/wallet";
import { BUILD_KEY } from "./garage-builds";
import { Garage } from "./garage.svelte";
import CarLock from "./CarLock.svelte";
import PartsMissing from "./PartsMissing.svelte";
import type { Menu } from "./page";
import PriceTag from "./ui/PriceTag.svelte";

function shop(credits: number) {
  const wallet = new Wallet(null);
  wallet.earn(credits);
  const garage = new Garage(DEFAULT_BUILD);
  garage.wallet = wallet;
  garage.given = () => wallet.state.cars;
  return { wallet, garage };
}

const pick = (garage: Garage, id: string) => garage.select(garage.items.find((item) => item.id === id)!);

test("a sold decal shows its price, can't be fitted unbought, and fits once bought", () => {
  const { wallet, garage } = shop(2500);
  pick(garage, "decal");
  const flames = garage.item.values!.indexOf(DECALS.indexOf("flames"));
  const centre = garage.item.values!.indexOf(DECALS.indexOf("centre"));
  expect(garage.price(centre)).toBeNull();
  expect(garage.price(flames)).toBe(2000);
  garage.fit(flames);
  expect(DECALS[garage.current.decal]).not.toBe("flames");
  expect(garage.buy(flames)).toBe(true);
  expect(DECALS[garage.current.decal]).toBe("flames");
  expect(wallet.credits).toBe(500);
  expect(garage.price(flames)).toBeNull();
});

test("a neon style short of credits stays unbought", () => {
  const { wallet, garage } = shop(5000);
  pick(garage, "neon");
  const ring = NEONS.indexOf("ring");
  expect(garage.price(ring)).toBe(6000);
  expect(garage.buy(ring)).toBe(false);
  expect(wallet.credits).toBe(5000);
  expect(garage.buy(NEONS.indexOf("pool"))).toBe(true);
  expect(wallet.has("neon.pool")).toBe(true);
});

test("an extra body on an owned frame is bought from the garage; a locked frame's is not for sale", () => {
  const { wallet, garage } = shop(20_000);
  garage.use_code(build_code({ ...DEFAULT_BUILD, car: "hagel" }), false);
  expect(garage.body_price).toBeNull();
  garage.use_code(build_code({ ...DEFAULT_BUILD, car: "kaze" }), false);
  expect(garage.locks.kaze).toBe("Buy it for 15,000 cr");
  expect(garage.body_price).toBe(15_000);
  expect(garage.buy_body()).toBe(true);
  expect(wallet.credits).toBe(5_000);
  expect(garage.locks.kaze).toBeUndefined();
  expect(garage.body_price).toBeNull();
});

test("a locked car picked at a race meet is lent, then handed back for the player's own", () => {
  const { garage } = shop(0);
  const own = garage.code;
  garage.meet_pick(build_code({ ...DEFAULT_BUILD, car: "formula" }));
  expect(garage.current.car).toBe("formula");
  garage.take_back();
  expect(garage.code).toBe(own);
  garage.meet_pick(build_code({ ...DEFAULT_BUILD, car: "coupe" }));
  garage.take_back();
  expect(garage.current.car).toBe("coupe");
});

test("a lent meet car is never saved as the player's own, even with a part fitted on it", () => {
  const writes: string[] = [];
  const real = globalThis.localStorage;
  globalThis.localStorage = { ...real, setItem: (key: string, value: string) => void (key === BUILD_KEY && writes.push(value)) } as Storage;
  try {
    const { garage } = shop(0);
    const own = garage.code;
    garage.meet_pick(build_code({ ...DEFAULT_BUILD, car: "formula" }));
    pick(garage, "engine");
    garage.fit(3);
    expect(garage.current.parts.engine).toBe(3);
    expect(writes).toEqual([]);
    garage.take_back();
    expect(garage.code).toBe(own);
    expect(writes).toEqual([]);
  } finally {
    globalThis.localStorage = real;
  }
});

test("the car picker's sold body buys from any car: its lock carries Buy, or how much is missing", () => {
  const { wallet, garage } = shop(20_000);
  expect(garage.car_price("kaze")).toBe(15_000);
  expect(garage.car_price("hagel")).toBeNull();
  const menu = { host: { series: [] } } as unknown as Menu;
  const lock = (credits: number) => render(CarLock, { props: { menu, car: "kaze", why: "Buy it for 15,000 cr", onround: () => {}, price: 15_000, credits, onbuy: () => {} } }).body;
  expect(lock(20_000)).toContain("Buy · 15,000 cr");
  expect(lock(5_000)).toContain("Need 10,000 cr more");
  expect(garage.buy_car("kaze")).toBe(true);
  expect(wallet.owns("kaze")).toBe(true);
  expect(garage.car_price("kaze")).toBeNull();
});

test("a build code wearing a sold decal or neon not bought loads onto the player's own car without it, with a note", async () => {
  const { wallet, garage } = shop(0);
  await wallet.load();
  const notes: string[] = [];
  garage.on_notice = (text) => notes.push(text);
  const dressed = build_code({ ...DEFAULT_BUILD, decal: DECALS.indexOf("flames"), neon: NEONS.indexOf("ring"), neon_tone: 2 });
  garage.use_code(dressed);
  expect(DECALS[garage.current.decal]).toBe("none");
  expect(NEONS[garage.current.neon]).toBe("none");
  expect(notes).toEqual(["Flames, Ring neon not owned: removed"]);
  garage.meet_pick(build_code({ ...DEFAULT_BUILD, car: "formula", decal: DECALS.indexOf("flames") }));
  expect(DECALS[garage.current.decal]).toBe("flames");
  garage.take_back();
  const free = build_code({ ...DEFAULT_BUILD, decal: DECALS.indexOf("twin") });
  garage.use_code(free);
  expect(garage.code).toBe(free);
  expect(notes.length).toBe(1);
});

test("a part not bought on this car shows its price, can't be fitted unbought, fits once bought and shows Owned after", () => {
  const { wallet, garage } = shop(10_000);
  pick(garage, "engine");
  expect(garage.price(0)).toBeNull();
  expect(garage.price(4)).toBe(9_000);
  expect(garage.price(5)).toBe(14_000);
  garage.fit(4);
  expect(garage.current.parts.engine).toBe(0);
  expect(garage.buy(5)).toBe(false);
  expect(garage.buy(4)).toBe(true);
  expect(garage.current.parts.engine).toBe(4);
  expect(wallet.credits).toBe(1_000);
  garage.fit(0);
  expect(garage.price(4)).toBeNull();
  expect(garage.bought(4)).toBe(true);
  expect(garage.bought(0)).toBe(false);
  garage.fit(4);
  expect(garage.current.parts.engine).toBe(4);
  expect(wallet.credits).toBe(1_000);
  pick(garage, "aero");
  expect(garage.price(2)).toBeNull();
  garage.use_code(build_code({ ...garage.current, car: "coupe" }), false);
  pick(garage, "engine");
  expect(garage.price(4)).toBe(9_000);
});

test("an unowned tyre or suspension falls back to stock, never another kind; a levelled slot to the nearest owned below", () => {
  const owned = new Set(["tyres.2", "suspension.4", "engine.2", "aero.2"]);
  const owns = (pick: PartPick) => part_price(pick.slot, pick.index) === 0 || owned.has(`${pick.slot}.${pick.index}`);
  const rally = { ...DEFAULT_BUILD, parts: { ...DEFAULT_BUILD.parts, tyres: 3, suspension: 3, engine: 4 } };
  const { build, missing } = own_parts(rally, owns);
  expect(build.parts.tyres).toBe(DEFAULT_PARTS.tyres);
  expect(build.parts.suspension).toBe(DEFAULT_PARTS.suspension);
  expect(build.parts.engine).toBe(2);
  expect(missing).toEqual([{ slot: "engine", index: 4 }, { slot: "tyres", index: 3 }, { slot: "suspension", index: 3 }]);
});

test("a build picked for a capped event races only on bought parts and cosmetics, without touching the fitted car", async () => {
  const { wallet, garage } = shop(0);
  await wallet.load();
  const notes: string[] = [];
  garage.on_notice = (text) => notes.push(text);
  const fitted = garage.code;
  const preset = build_code({ ...DEFAULT_BUILD, decal: DECALS.indexOf("flames"), parts: { ...DEFAULT_BUILD.parts, engine: 3, nitro: 2 } });
  expect(garage.owned_code(preset)).toBe(build_code(DEFAULT_BUILD));
  expect(notes).toEqual(["Flames not owned: removed · Supercharger engine, Big tank nitro not owned: fitted the best you own"]);
  expect(garage.code).toBe(fitted);
  expect(garage.missing).toBeNull();
  expect(garage.owned_code(fitted)).toBe(fitted);
});

test("Enter on a part not bought buys it, like the Buy action it labels", () => {
  const { wallet, garage } = shop(2_000);
  garage.open();
  try {
    pick(garage, "engine");
    garage.preview(1);
    garage.navigate(["accept"]);
    expect(garage.current.parts.engine).toBe(1);
    expect(wallet.credits).toBe(0);
  } finally {
    garage.close();
  }
});

test("a build code with parts not bought loads the best owned below each, and Buy missing pays once for all of them", async () => {
  const { wallet, garage } = shop(0);
  await wallet.load();
  const notes: string[] = [];
  garage.on_notice = (text) => notes.push(text);
  wallet.earn(9_000);
  pick(garage, "engine");
  garage.buy(4);
  const tuned = { ...DEFAULT_BUILD, parts: { ...DEFAULT_BUILD.parts, engine: 5, tyres: 6, aero: 5 } };
  garage.use_code(build_code({ ...tuned, decal: DECALS.indexOf("flames") }));
  expect(garage.current.parts).toEqual({ ...DEFAULT_BUILD.parts, engine: 4, tyres: 0, aero: 2 });
  expect(notes).toEqual(["Flames not owned: removed · Twin turbo engine, Slicks tyres, GT kit not owned: fitted the best you own"]);
  expect(garage.missing?.price).toBe(14_000 + 6_000 + 8_000);
  expect(garage.buy_missing()).toBe(false);
  expect(render(PartsMissing, { props: { parts: garage.missing!.parts, price: 28_000, credits: 0, onbuy: () => {} } }).body).toContain("Need 28,000 cr more");
  wallet.earn(30_000);
  expect(render(PartsMissing, { props: { parts: garage.missing!.parts, price: 28_000, credits: 30_000, onbuy: () => {} } }).body).toContain("Buy missing parts · 28,000 cr");
  expect(garage.buy_missing()).toBe(true);
  expect(garage.code).toBe(build_code(tuned));
  expect(notes.length).toBe(1);
  expect(wallet.credits).toBe(2_000);
  expect(garage.missing).toBeNull();
  expect(garage.buy_missing()).toBe(false);
  expect(wallet.credits).toBe(2_000);
});

test("a lent meet car and a loaner fitted unsaved keep their parts; the boot check strips a saved car's", async () => {
  const { wallet, garage } = shop(0);
  await wallet.load();
  const formula = build_code({ ...DEFAULT_BUILD, car: "formula", parts: { ...DEFAULT_BUILD.parts, engine: 5 } });
  garage.meet_pick(formula);
  expect(garage.code).toBe(formula);
  pick(garage, "engine");
  expect(garage.price(3)).toBeNull();
  expect(garage.bought(3)).toBe(false);
  garage.take_back();
  const loaner = build_code({ ...DEFAULT_BUILD, car: "rally", parts: { ...DEFAULT_BUILD.parts, tyres: 3 } });
  garage.use_code(loaner, false);
  expect(garage.code).toBe(loaner);
  const linked = new Garage({ ...DEFAULT_BUILD, parts: { ...DEFAULT_BUILD.parts, nitro: 2 } });
  linked.wallet = wallet;
  linked.check_owned();
  expect(linked.current.parts.nitro).toBe(0);
  expect(linked.missing?.price).toBe(6_000);
});

test("a price tag reads in grouped credits", () => {
  expect(render(PriceTag, { props: { price: 15000 } }).body).toContain("15,000 cr");
});
