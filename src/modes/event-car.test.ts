import { expect, test } from "bun:test";
import { EventCar, type CarHooks } from "./event-car";

test("a cup's loaner goes on through the lend hook and the player's own comes back saved", () => {
  let on = "own";
  const calls: string[] = [];
  const hooks: CarHooks = {
    pick_car: null,
    fit_car: (code, save) => {
      calls.push(`fit ${code} ${save}`);
      on = code;
    },
    lend_car: (code) => {
      calls.push(`lend ${code}`);
      on = code;
    },
    car_code: () => on,
    save_car: null,
  };
  const car = new EventCar(hooks);
  car.lend("loaner");
  expect(car.borrowed).toBe(true);
  car.give_back();
  expect(calls).toEqual(["lend loaner", "fit own true"]);
  car.wear("picked");
  expect(calls.at(-1)).toBe("fit picked false");
});
