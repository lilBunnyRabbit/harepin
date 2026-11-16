import { Idb } from "../store/idb";
import { WALLET_ID, type WalletState } from "./wallet";

const STORE = "wallet";

export interface WalletSaves {
  load(): Promise<unknown>;
  save(state: WalletState): Promise<void>;
}

export class WalletDb implements WalletSaves {
  constructor(private readonly db = new Idb()) {}

  load(): Promise<unknown> {
    return this.db.get(STORE, WALLET_ID);
  }

  save(state: WalletState): Promise<void> {
    return this.db.put(STORE, state);
  }
}
