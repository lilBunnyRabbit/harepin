import { car_spec } from "../src/car/cars";
import { telemetry } from "./bench/telemetry-cases";

const r = telemetry(car_spec(process.argv[2] ?? "coupe"));
console.log(`settled: CG height ${r.cg.toFixed(3)} m, loads ${r.loads.map((l) => l.toFixed(0)).join(" / ")} N`);
for (const l of r.launch) console.log(`0-100 km/h (TCS ${l.tcs ? "on" : "off"}): ${l.t100.toFixed(2)} s, gear ${l.gear}`);
console.log(`top speed after 40 s more: ${r.top.kmh.toFixed(0)} km/h, gear ${r.top.gear}, rpm ${r.top.rpm.toFixed(0)}`);
for (const s of r.stop) console.log(`100-0 km/h braking (ABS ${s.abs ? "on" : "off"}): ${s.m.toFixed(1)} m`);
for (const s of r.skidpad) console.log(`skidpad 70 km/h steer ${s.steer}: ${s.g.toFixed(2)} g, speed ${s.kmh.toFixed(0)} km/h, upright ${s.upright.toFixed(3)}`);
console.log(`max steady lateral: ${r.best_g.toFixed(2)} g`);
console.log(`handbrake flick then recover (assist): yaw rate ${r.flick.yaw.toFixed(2)} rad/s after ${r.flick.t.toFixed(2)} s, upright ${r.flick.upright.toFixed(3)}`);
