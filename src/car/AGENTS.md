# car/

- `car.test.ts` is bit-exact. A refactor keeps it passing unchanged, and `scripts/telemetry.ts` / `scripts/feel.ts` print byte-identical output (capture both before the first edit, `cmp` after).
- A handling change is a tuning decision: run the scripts before and after and put the numbers in the commit body.
- The step runs at 360 Hz: no allocation, closure or array method inside it. Scratch vectors live at module level or on the car.
- Wheels belong to axles (`axles_of`, `Wheel.axle`, `Wheel.pair`); size per-wheel arrays by `wheels.length`, never assume 4 or index by number.
- One `RigidBody` per car today. Multi-body vehicles plan: `spec.bodies[]` (mass, inertia, mounts, axles each), `joints: { a, b, at_a, at_b, limit }[]`, a joint solver before each `integrate`, extra body poses as an optional car-packet field. Build it only with the first jointed vehicle.
