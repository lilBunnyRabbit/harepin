import { expect, test } from "bun:test";
import { HAREPIN_DB } from "../store/idb";
import { BASE_CAR, MAX_CREDITS, WALLET_ID, Wallet, credits_text, fresh_wallet, parse_wallet, type WalletState } from "./wallet";
import type { WalletSaves } from "./wallet-db";

function memory(): WalletSaves & { data: { value: unknown } } {
  const data = { value: undefined as unknown };
  return { data, load: async () => structuredClone(data.value), save: async (s: WalletState) => void (data.value = structuredClone(s)) };
}

test("the database has a wallet store keyed by id, on a version above master's v3 (ghosts, kv)", () => {
  expect(HAREPIN_DB.stores).toContainEqual({ name: "wallet", key: "id" });
  expect(HAREPIN_DB.version).toBeGreaterThanOrEqual(4);
});

test("everyone starts on the base car with no credits", () => {
  expect(fresh_wallet()).toEqual({ id: WALLET_ID, credits: 0, cars: [BASE_CAR], cosmetics: [], bonus_day: "" });
  expect(parse_wallet(undefined)).toEqual(fresh_wallet());
});

test("a stored wallet is checked: bad totals read as none, unknown cars drop, the base car stays owned", () => {
  expect(parse_wallet({ credits: 1200, cars: ["sajin"] })).toEqual({ id: WALLET_ID, credits: 1200, cars: [BASE_CAR, "sajin"], cosmetics: [], bonus_day: "" });
  for (const credits of [-5, 1.5, "900", MAX_CREDITS + 1, Number.NaN, null]) expect(parse_wallet({ credits, cars: [] }).credits).toBe(0);
  expect(parse_wallet({ credits: 0, cars: ["nope", 7, "sajin", "sajin", BASE_CAR] }).cars).toEqual([BASE_CAR, "sajin"]);
  expect(parse_wallet({ credits: 10, cars: "sajin" }).cars).toEqual([BASE_CAR]);
  expect(parse_wallet("junk")).toEqual(fresh_wallet());
});

test("credits and cars survive a reload; a refused store still opens on the base car", async () => {
  const store = memory();
  const wallet = new Wallet(store);
  wallet.earn(1400);
  wallet.earn(0);
  wallet.earn(-50);
  expect(wallet.grant("sajin")).toBe(true);
  expect(wallet.grant("sajin")).toBe(false);
  const again = new Wallet(store);
  await again.load();
  expect(again.ready).toBe(true);
  expect(again.state).toEqual({ id: WALLET_ID, credits: 1400, cars: [BASE_CAR, "sajin"], cosmetics: [], bonus_day: "" });
  const refused = new Wallet({ load: () => Promise.reject(new Error("blocked")), save: async () => {} });
  await refused.load();
  expect(refused.ready).toBe(true);
  expect(refused.state).toEqual(fresh_wallet());
});

test("credits earned while the load is out are kept over what it reads", async () => {
  let open = (_: unknown) => {};
  const wallet = new Wallet({ load: () => new Promise((resolve) => (open = resolve)), save: async () => {} });
  const loading = wallet.load();
  wallet.earn(300);
  open({ credits: 9000, cars: [] });
  await loading;
  expect(wallet.credits).toBe(300);
});

test("cosmetics and the bonus day load checked: unknown or free ids drop, a bad day reads as none", () => {
  const read = parse_wallet({ credits: 0, cars: [], cosmetics: ["decal.flames", "decal.centre", "neon.ring", "neon.ring", "warp", 4], bonus_day: "2026-11-20" });
  expect(read.cosmetics).toEqual(["decal.flames", "neon.ring"]);
  expect(read.bonus_day).toBe("2026-11-20");
  for (const bonus_day of ["yesterday", 20261120, null]) expect(parse_wallet({ bonus_day }).bonus_day).toBe("");
});

test("a buy takes the credits and adds the item in one write; short of credits or owned already, nothing changes", async () => {
  const store = memory();
  let writes = 0;
  const counted: WalletSaves = { load: store.load, save: (s) => (writes++, store.save(s)) };
  const wallet = new Wallet(counted);
  wallet.earn(5000);
  writes = 0;
  expect(wallet.buy({ kind: "cosmetic", id: "neon.ring" }, 6000)).toBe(false);
  expect(wallet.buy({ kind: "cosmetic", id: "decal.flames" }, 2000)).toBe(true);
  expect(writes).toBe(1);
  expect(wallet.buy({ kind: "cosmetic", id: "decal.flames" }, 2000)).toBe(false);
  expect(wallet.buy({ kind: "car", car: "kaze" }, 3000)).toBe(true);
  expect(wallet.buy({ kind: "car", car: "kaze" }, 0)).toBe(false);
  expect(writes).toBe(2);
  const again = new Wallet(store);
  await again.load();
  expect(again.state).toMatchObject({ credits: 0, cars: [BASE_CAR, "kaze"], cosmetics: ["decal.flames"] });
  expect(again.has("decal.flames")).toBe(true);
});

test("the daily bonus pays once per UTC day", () => {
  const wallet = new Wallet(null);
  expect(wallet.claim_daily("2026-11-20", 2000)).toBe(true);
  expect(wallet.claim_daily("2026-11-20", 2000)).toBe(false);
  expect(wallet.claim_daily("2026-11-21", 2000)).toBe(true);
  expect(wallet.credits).toBe(4000);
});

test("credits read as grouped thousands", () => {
  expect(credits_text(12500)).toBe("12,500 cr");
});
