# Car style guide

How the owner wants cars to look. Distilled from eight review rounds of the car refresh (2026-11-13/14). Read this before designing or changing any car body, part look or kit. Real-car references and the photo list: `~/dev/hq/projects/harepin/knowledge/car-bodies.md` (`car-refs/`).

## The rule above all

The low-poly house style wins over the reference. A real car gives a body two or three signature cues (proportion, stance, one iconic feature) and nothing more. Round 3 copied the photos closely and the owner's verdict was "more detailed and worse, shapes are weird". When in doubt, remove detail.

- Few, clean, bold shapes. Triangle count at or below the round-2 lineup (about 1,200-2,000 per car stock).
- Nothing a player can't read at chase-camera distance: no seams, louvres, rivets, slats, canards, door handles, markers or vents.
- No odd facets, steps or creases where two pieces meet. A part that looks "off" usually means two shapes fight; merge or drop one.

## Stock body and kit levels

Every car has a stock body: the car as it left the factory. The aero kit levels add the tuner parts. Owner, 11-13: "the cars need their base versions and the aero kits would then add the wide body, spoiler and all of that".

- Stock: narrow arches, the car's own lip or ducktail, plain rims, no splitter.
- Kit levels 1-4 grow from there: lip, small spoiler, then wide arches with skirts, then the big wing and splitter.
- The wide body arrives with the skirts level (Street kit), not with the lip or wing levels.

## Wheel arches

The owner's favourite was the round-4 hatch: a thin lip that follows the wheel opening.

- Every car: a thin lip round the opening, capped at the body top so it never stands over a low bonnet.
- No bulging pods, hips or fender humps that read as separate blobs ("weird geometry with wheel bumpers").
- Black trim only where the reference has plastic arches (hatch, rally). Body colour everywhere else.
- The opening and its lip are six even facets, the same angle as the 12-sided wheels. The lip keeps one width all the way round and on both axles; under a low bonnet the whole lip narrows instead of thinning at the top.
- Every opening clears its tyre at full steering lock with the widest tyre the car can fit. A kit that needs more room gets a wider gap or a narrower front tyre.
- The car reads solid: a dark well closes each opening between the tyres, so no arch shows the far wheel.
- A wheel pod beside a low body (Fujin) keeps a body-colour wall on the body side, so no tyre shows over the bonnet; its dark well sits behind that wall.
- Open-wheel cars: suspension arms run from the body side (never over its top) to the hub centre, and no arm, floor or wing shows through a tyre. `model-faces.test.ts` checks all of this.

## Spoilers and wings

Most rounds' notes were about spoilers. They must look attached and intentional.

- Attached to the body: a roof spoiler sits on the roof edge, wing legs start inside the deck. Nothing floats.
- Never wider than the body sides.
- No spoiler on spoiler: when a kit wing goes on, the stock ducktail or lip goes away.
- Black on the wing blade gives the "cool look" (coupe kit hoop, kaze): black blade on body-colour legs. Judge per car.
- Each car gets a wing that suits it: a 964 ducktail and a big RWB-style wing (Sturm), a sedan GT wing (Raijin), a late-60s trunk duck up to a pedestal plank (muscle), a two-element roof wing (rally).
- Not boring, not overdone: the formula's rear wing is one main plane plus a flap with slim endplates. "No F1 has such a back spoiler."

## Fronts

- Splitters and front wings lie flat. Nothing angled up ("like it wants the car to fly").
- Every front-wing element stays clear of the wheels at full steering lock.
- Headlights read as their own shapes. On the Sturm the round lamps sit on the fender fronts, separate from the arch ("looks like the batman car" when merged).

## Rears

- A rear must not read as a face: lamps plus plate arranged like eyes and a mouth looked bad on the Raijin.
- Keep visible exhausts where the car has them.
- The tail is one surface: no gaps between the rear arch, the hips and the lamp panel (Sturm round 6).

## Per car

| Car | Reference | What makes it read |
|---|---|---|
| Hatch | own design | thin black arch lips, roof spoiler on the roof edge |
| Coupe | 90s Japanese liftback | low wedge nose, glass fastback; black blade on the kit wing |
| Muscle | late-60s American | long flat hood, upright quad-lamp grille, short notchback |
| Rally | Ford Fiesta (2011 WRC / gymkhana) | short supermini hatch, steep tailgate, rising window line; black arches; WRC kit with roof wing |
| Kaze | Nissan 350Z | long hood, short tail; black wing blade |
| Sturm | Porsche 964 / RWB | round lamps on raised fenders, sloping fastback; slim, not "fatter" |
| Raijin | Mitsubishi Evo X | sedan stance, shark nose, GT wing; clean tail with exhausts |
| Formula | 2026 F1 | narrow nose, sidepods, no halo, flat front wing, simple rear wing; driver a low helmet |
| Fujin | Legend car (endurance prototype) | bubble canopy between wheel pods, fin, full-width wing |
| Tsumuji | 1990 pop-up roadster, hardtop | big pop-up headlights that rise with the lights key |
| Sajin | modern sand buggy | cage, exposed long-travel arms, big tyres |

Naming: weather and wind words in the style of Sturm, Raijin, Kaze, Fujin. No real brand or model names in the game.

## Details by fitted part

On top of the kit, each car wears the cues of its own tuning scene, each brought by one fitted part (`DETAILS` in `src/car/car-details.ts`). Stock stays clean.

| Car | Scene | Cues |
|---|---|---|
| Hatch | track day | offset tow hooks, centre-exit pipes, cage cross in the hatch glass |
| Coupe | 90s highway | underglow tubes, bazooka pipes, front-mount intercooler |
| Muscle | pro street | chrome side pipes, rear louvres, blower through the hood, wheelie bars |
| Rally | gravel stage | red mudflaps, roof scoop, lamp pod, sump guard |
| Kaze | pro drift | camber, tow straps, bash bar in place of the rear bumper |
| Tsumuji | clean roadster | camber, roll hoop; never a bonnet bulge or bare panel |
| Sturm | RWB | four bolt heads per arch, windscreen banner, oil cooler |
| Raijin | time attack | intercooler, floor planes, red tow hook, fences and canards |
| Formula | grand prix | T-camera, bargeboards, shark fin, T-wing; helmet in body colour |
| Fujin | endurance | one side-exit pipe each side, nothing else |
| Sajin | dunes | whips with flags, jerry cans |
| Bus | haulage | bull bar, chrome stacks clear of the spoiler |

- A few bold shapes per tier; a cue that reads as clutter goes (owner, round 3: no plates, no double wing, nothing on a clean bonnet).
- A detail takes the place of the generic part it stands for (`swaps`), never stacks on it.
- Pipes a detail brings carry their own blue nitro tips.

## Nitro

- Hidden tank on every car, blue pipe tips.
- The flame is a thin blue jet in three layers (soft wide outer, jet, bright core with two beads).
- The tip bends smoothly to the inside of a turn, at no measurable frame cost.

## How reviews run

The owner reviews on a phone. Each round goes out as one page: per car the previous pick beside the new pass, one view at a time (stock or kit, front, side or rear), with a pick and a note per car and one Copy button. Fixes go to a Fable designer; a parallel Opus pass helped once when the style had drifted.
