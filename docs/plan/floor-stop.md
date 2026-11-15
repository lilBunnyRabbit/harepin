# Floor stop

Found on t298 (owner: the Sturm's body sinks into the road at speed in `?lab=t3b-sturm-grip` trial 5). Shipped then: only the drawn fix (kit bands, lips, splitters and diffusers stop at `hull_floor`). The physics fix waits for the shared-maths rebaseline in [sim-performance.md](sim-performance.md), where records reset anyway.

## What is wrong in the sim

- The bump stop engages at `compression > rest`: the wheel centre level with its mount. On every car that is past the point where the hull corners meet flat road, so nothing stops a strut before the floor does.
- At top speed the Race kit (downforce x3.6) and the GT kit (x6) press 3-4x the car's weight. Struts compress about 0.24 m, the hull corners go 1-3 cm into the road, and `hull()` carries the rest with its 0.6 friction.
- That scrape, not drag, sets the top speed of GT kit builds today. Today's top-build top speeds are an artefact: the Fujin top build (271 km/h) is slower than its Race kit build (305).
- Downforce costs no speed of its own. Only the load-dependent rolling term and the scrape tie it to speed.

## The fix that was built and reverted (c105ce2, reverted in 283be33)

- Per wheel `floor_stop = reach - mount.y + min(corner y) - FLOOR_CLEAR` (0.04 m), a second stop at `FLOOR_BUMP` 250 kN/m on top of the existing bump stop.
- 400 kN/m tipped the sajin past 35 degrees off a 25 m/s brink, and 1 MN/m rolled the raijin past 40 on a crest landing (`car.test.ts`).
- Stock telemetry and feel came out byte-identical. Only cars that reach the floor change, which means GT and Race kit builds at speed, plus a little on rough grass (`offroad.ts` vertical rms 7.44 to 7.48).
- Fujin GT builds still bottomed: their downforce runs into `strut_max` (40 kN a wheel).

## Top speed, km/h, sim flat-out 60 s (best = BEST_PARTS with Race kit; top = twin turbo, slicks, GT kit, carbon shell; gt = BEST_PARTS with GT kit)

| car | best today | best stop | top today | top stop | gt today | gt stop |
|---|---|---|---|---|---|---|
| hatch | 188 | 188 | 214 | 216 | 179 | 179 |
| coupe | 269 | 269 | 299 | 317 | 257 | 260 |
| muscle | 289 | 289 | 299 | 338 | 268 | 278 |
| rally | 255 | 255 | 261 | 261 | 241 | 246 |
| kaze | 261 | 261 | 293 | 308 | 246 | 246 |
| sturm | 291 | 296 | 296 | 334 | 257 | 271 |
| raijin | 252 | 266 | 268 | 305 | 223 | 258 |
| formula | 308 | 311 | 276 | 320 | 254 | 300 |
| fujin | 305 | 336 | 271 | 307 | 247 | 295 |
| tsumuji | 184 | 184 | 221 | 221 | 176 | 176 |
| sajin | 197 | 197 | 217 | 217 | 193 | 193 |

PI never saw the scrape (`stats().top_speed` is the drag limit), so ratings do not move with the stop alone.

## Retune options tried for that release

- **Kit drag alone** can't hold today's speeds: the gain per car depends on how hard each one scraped. GT drag 0.42 still leaves sturm, raijin and muscle top builds +18 to +22, while hatch, coupe and kaze drop 10-14. Any GT drag over 0.26 takes the sajin GT build from 600 to 59x (A to B).
- **Lower kit downforce** drops kaze top (808) and raijin top (813) to S1. Any Race kit change drops the Sturm Best build (701) to A.
- **Kits that add downforce instead of scaling it** spread badly across cars: light, low-downforce cars gain the most.
- **Downforce cap, `LIMITS.downforce` in `build.ts`**: only formula and fujin kits reach it, so stock and road cars stay identical and no class moves. Cap 12 keeps every floor clear, but the fujin's Race and GT kits then make the same downforce. Cap 14 leaves the formula top build 3 mm into the road. This is the option to start from, then decide whether road-car top speeds may rise.

## Drawn body

- The drawn body is pinned to the road (`body.position.y = -ride_height(spec)`): a lowered or lifted build moves the hull but not the body. A patch that hangs the body at the stock car's ride height (`body_y`, garage stand and asset viewer to match) is ready to land with the rebaseline. It puts the Sturm kit's chin 2 mm into the tyre at full lock on the Drift suspension.
- Sturm design (t299): the stock sill between the wheels sits at 0.11 m and the rest of the floor at 0.15-0.16. The kit shell, chin and splitter sit at 0.085-0.10. The hull floor is 0.171. Everything under it needs raising.
