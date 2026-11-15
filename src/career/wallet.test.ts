import { expect, test } from "bun:test";
import { HAREPIN_DB } from "../store/idb";
import { BASE_CAR, MAX_CREDITS, WALLET_ID, Wallet, credits_text, fresh_wallet, parse_wallet, type WalletState } from "./wallet";
import type { WalletSaves } from "./wallet-db";

function memory(): WalletSaves & { data: { value: unknown } } {
  const data = { value: undefined as unknown };
  return { data, load: async () => structuredClone(data.value), save: async (s: WalletState) => void (data.value = structuredClone(s)) };
}

test("the database has a wallet store keyed by id, on a version past the series-only one", () => {
  expect(HAREPIN_DB.stores).toContainEqual({ name: "wallet", key: "id" });
  expect(HAREPIN_DB.version).toBeGreaterThanOrEqual(2);
});

test("everyone starts on the base car with no credits", () => {
  expect(fresh_wallet()).toEqual({ id: WALLET_ID, credits: 0, cars: [BASE_CAR] });
  expect(parse_wallet(undefined)).toEqual(fresh_wallet());
});

test("a stored wallet is checked: bad totals read as none, unknown cars drop, the base car stays owned", () => {
  expect(parse_wallet({ credits: 1200, cars: ["sajin"] })).toEqual({ id: WALLET_ID, credits: 1200, cars: [BASE_CAR, "sajin"] });
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
  expect(again.state).toEqual({ id: WALLET_ID, credits: 1400, cars: [BASE_CAR, "sajin"] });
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

test("credits read as grouped thousands", () => {
  expect(credits_text(12500)).toBe("12,500 cr");
});
