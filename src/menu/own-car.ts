import { load_builds } from "../car/builds";
import { car_shelves } from "../car/car-pick";
import { open_presets } from "../career/rewards";
import { CAR_PAGE, type CarPicker } from "./car-pick.svelte";
import type { Menu } from "./page";

/** The picker for the player's own car, any class; a pick becomes their car and the menu returns to `from`. */
export async function change_own_car(menu: Menu, picker: CarPicker, from: string) {
  const { garage } = menu.host;
  const shelves = car_shelves(garage.build, load_builds(), open_presets(garage.held_cars), { cap: null, car_sized_only: false });
  const asked = picker.open({ title: from, limit: "any class", shelves, note: "Your car from now on.", back: from });
  menu.show(CAR_PAGE);
  const code = await asked;
  if (!code) return;
  garage.use_code(code);
  menu.back();
}
