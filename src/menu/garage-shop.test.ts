import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { DECALS, DEFAULT_BUILD, NEONS, build_code } from "../car/build";
import { Wallet } from "../career/wallet";
import { BUILD_KEY } from "./garage-builds";
import { Garage } from "./garage.svelte";
import CarLock from "./CarLock.svelte";
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

test("a price tag reads in grouped credits", () => {
  expect(render(PriceTag, { props: { price: 15000 } }).body).toContain("15,000 cr");
});
