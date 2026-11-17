/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Car } from "../car/car";
import { COUPE } from "../car/cars";
import { Awareness } from "./awareness";
import { Driver } from "./driver";
import { race_line, type RaceLine } from "./line";
import { ring } from "./test-road";

function put(line: RaceLine, car: Car, driver: Driver, index: number, side: number, speed: number) {
  const p = line.road[index];
  const lateral = line.offset[index] + side;
  car.place(p.x + p.tz * lateral, 1, p.z - p.tx * lateral, Math.atan2(p.tx, p.tz));
  car.vel.set(p.tx * speed, 0, p.tz * speed);
  driver.place(index);
  driver.target = speed;
}

describe("AI awareness", () => {
  test("a passer still in the passed car's lane, held behind it, is not lifted for: the two never cap each other down to a stop", () => {
    const line = race_line(ring(800), [], COUPE.radius);
    const ahead = new Driver(line, { pace: 0.96, brake_margin: 0, aggression: 0, mistakes: 0 });
    const behind = new Driver(line, { pace: 1.02, brake_margin: 0, aggression: 1, mistakes: 0 });
    const cars = [new Car(COUPE), new Car(COUPE)];
    const awareness = new Awareness(cars, [ahead, behind], () => 0);
    put(line, cars[0], ahead, 100, 0, 20);
    put(line, cars[1], behind, 95, 0.5, 24);
    awareness.update(0.05);
    expect(Number.isNaN(behind.hold)).toBe(false);
    put(line, cars[1], behind, 98, 0.5, 24);
    awareness.update(0.05);
    expect(behind.cap).toBeLessThan(Infinity);
    expect(ahead.cap).toBe(Infinity);
  });

  test("behind two cars a row apart, the slower one past the nearest caps it too", () => {
    const line = race_line(ring(800), [], COUPE.radius);
    const drivers = [new Driver(line), new Driver(line), new Driver(line)];
    const cars = drivers.map(() => new Car(COUPE));
    const awareness = new Awareness(cars, drivers, () => 0);
    put(line, cars[0], drivers[0], 104, 3, 15);
    put(line, cars[1], drivers[1], 100, -1, 30);
    put(line, cars[2], drivers[2], 95, 1, 30);
    awareness.update(0.05);
    expect(drivers[2].cap).toBeLessThan(20);
  });

  test("a car ahead on the pace deeper into a braking zone does not hold the follower to its speed there; one well under the pace does", () => {
    const line = race_line(ring(800), [], COUPE.radius);
    line.speed.fill(60);
    line.speed.fill(40, 120, 140);
    const drivers = [new Driver(line), new Driver(line)];
    const cars = drivers.map(() => new Car(COUPE));
    const awareness = new Awareness(cars, drivers, () => 0);
    put(line, cars[0], drivers[0], 125, 0, 40);
    put(line, cars[1], drivers[1], 100, 0, 55);
    awareness.update(0.05);
    expect(drivers[1].cap).toBeGreaterThan(60);
    put(line, cars[0], drivers[0], 125, 0, 20);
    awareness.update(0.05);
    expect(drivers[1].cap).toBeLessThan(30);
  });

  test("a car beside its lane now, on the path it is easing onto, caps it", () => {
    const line = race_line(ring(800), [], COUPE.radius);
    const drivers = [new Driver(line), new Driver(line)];
    const cars = drivers.map(() => new Car(COUPE));
    const awareness = new Awareness(cars, drivers, () => 0);
    put(line, cars[0], drivers[0], 110, 3, 15);
    put(line, cars[1], drivers[1], 100, 0, 30);
    awareness.update(0.05);
    expect(drivers[1].cap).toBe(Infinity);
    drivers[1].aside = 3;
    awareness.update(0.05);
    expect(drivers[1].cap).toBeLessThan(25);
  });
});
