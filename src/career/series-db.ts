import { Idb } from "../store/idb";
import type { SeriesProgress } from "./series";

const STORE = "series";

export interface SeriesSaves {
  load(season: string): Promise<unknown>;
  save(progress: SeriesProgress): Promise<void>;
}

export class SeriesDb implements SeriesSaves {
  constructor(private readonly db = new Idb()) {}

  load(season: string): Promise<unknown> {
    return this.db.get(STORE, season);
  }

  save(progress: SeriesProgress): Promise<void> {
    return this.db.put(STORE, progress);
  }
}
