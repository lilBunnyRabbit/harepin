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

## Landed with the shared-maths rebaseline (t286)

- Floor stop as built in c105ce2, plus rebound damping: `FLOOR_DAMP` 20 kN·s/m against the strut extending out of the stop, never pulling (`car/tyre.ts`). Undamped, road kickers handed the compression back as lift and coupe, muscle, kaze and sturm landed 98-109 m out, past the landing; frozen-fall drops yawed. Softer `FLOOR_BUMP` or a smaller `FLOOR_CLEAR` scraped the top builds again; damping both ways tipped sharp-brink landings; a stop that could pull lifted the bus off its wheels.
- `LIMITS.downforce` caps kit downforce at 12 (`DOWNFORCE_CAP`, `car/build.ts`): the formula and fujin kits stop pushing past the stop. The fujin's Race and GT kits now make the same downforce.
- Owner call pending: top speeds rise, classes stay where they were (PI never saw the scrape).

Sim flat-out 60 s on flat ground, km/h, and the lowest hull corner over the road (builds as in the table above). Before is ce6af9c (old maths, bisected ray, no stop); after is this branch.

| car | best before | best after | top before | top after | gt before | gt after | PI best / top / gt |
|---|---|---|---|---|---|---|---|
| bus | 119 (223mm) | 119 (224mm) | 127 (256mm) | 127 (256mm) | 119 (221mm) | 119 (221mm) | D / D / D |
| coupe | 269 (81mm) | 269 (81mm) | 299 (-5mm) | 316 (25mm) | 257 (19mm) | 260 (35mm) | A / S2 / A |
| formula | 308 (-1mm) | 311 (21mm) | 276 (-17mm) | 320 (4mm) | 254 (-8mm) | 299 (10mm) | X / X / X |
| fujin | 305 (-8mm) | 335 (9mm) | 271 (-30mm) | 352 (4mm) | 247 (-15mm) | 324 (14mm) | X / X / X |
| hatch | 188 (66mm) | 188 (66mm) | 214 (16mm) | 216 (33mm) | 179 (39mm) | 179 (39mm) | B / A / B |
| kaze | 261 (87mm) | 261 (87mm) | 293 (-2mm) | 306 (25mm) | 246 (38mm) | 246 (38mm) | A / S2 / A |
| muscle | 289 (43mm) | 289 (43mm) | 299 (-8mm) | 338 (22mm) | 268 (-2mm) | 278 (31mm) | A / S2 / A |
| raijin | 252 (-3mm) | 266 (18mm) | 268 (-15mm) | 303 (9mm) | 223 (-8mm) | 255 (18mm) | A / S2 / A |
| rally | 255 (54mm) | 255 (54mm) | 261 (-4mm) | 261 (32mm) | 241 (-1mm) | 246 (34mm) | A / S1 / A |
| sajin | 197 (339mm) | 197 (339mm) | 217 (306mm) | 217 (306mm) | 193 (314mm) | 193 (314mm) | B / S1 / A |
| sturm | 291 (-2mm) | 297 (9mm) | 296 (-13mm) | 338 (2mm) | 257 (-7mm) | 275 (7mm) | S1 / S2 / S1 |
| tsumuji | 184 (59mm) | 184 (59mm) | 221 (21mm) | 221 (38mm) | 180 (36mm) | 180 (38mm) | B / A / B |

PI and class identical before and after on every build above.
