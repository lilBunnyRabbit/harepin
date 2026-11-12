import { is_lap } from "../car/ghost";
import { ghost_path, type CareerEvent } from "./career";

const laps = new Map<string, Promise<number[] | null>>();

// Not precached by the service worker: offline, an event runs without its ghost.
export function dev_ghost(event: CareerEvent): Promise<number[] | null> {
  const path = ghost_path(event);
  let lap = laps.get(path);
  if (!lap) {
    lap = fetch(`${import.meta.env.BASE_URL}${path}`)
      .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
      .then(
        (value) => (is_lap(value) ? value : null),
        (error: unknown) => {
          console.warn("career: dev ghost not loaded", error);
          return null;
        },
      );
    laps.set(path, lap);
  }
  return lap;
}
