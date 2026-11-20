import { load_builds } from "../car/builds";
import { car_shelves, type CarLocks } from "../car/car-pick";
import { open_presets } from "../career/rewards";
import { CAR_PAGE, type CarPicker } from "./car-pick.svelte";
import type { Menu } from "./page";

/** The picker for the player's own car, any class; a pick goes to `use`, their car by default, and the menu returns to `from`. A P2P room passes `NO_LOCKS`: any frame races there. */
export async function change_own_car(menu: Menu, picker: CarPicker, from: string, locked: CarLocks = menu.host.garage.locks, use = (code: string) => menu.host.garage.use_code(code)) {
  const { garage } = menu.host;
  const shelves = car_shelves(garage.build, load_builds(), open_presets(garage.held_cars), { cap: null, car_sized_only: false, locked });
  const asked = picker.open({ title: from, limit: "any class", shelves, note: "Your car from now on.", back: from });
  menu.show(CAR_PAGE);
  const code = await asked;
  if (!code) return;
  use(code);
  menu.back();
}
