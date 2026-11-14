# Car feel targets

Draft for owner sign-off (decision O1, `docs/plan/feel-lab-v2.md` 2). The handling twin of `docs/car-style.md`: one line of character per car and a band per trait of the handling golden (`scripts/golden/handling.txt`, row `<car>.stock asphalt`, keys as there). A number outside its band is a bug; a number inside it with a bad rating is a feel problem.

Status: **draft, not ticked**. Bands start from the measured stock numbers on 2a1bf3e and the 2026-11-09 spec in `docs/plan/handling.md`. `?` marks a number the draft doubts: today's value sits outside the band on purpose, for the owner or `t3-lineup` / `t4-throttle` to settle.

| car | character | t100 s | top km/h | stop m | g | turn ms | lift ° | pwr ° | must stand out |
|---|---|---|---|---|---|---|---|---|---|
| hatch | FWD, light, safe | 8.5-10 | 180-195 | 32-36 | 0.94-1.02 | 45-52 | 5-11 | 0-3 | sharpest road turn-in, never spins on lift |
| coupe | balanced RWD reference | 4.8-5.4 | 260-275 | 30-33 | 0.90-0.97 | 56-64 | 3-6 | 22-30 | none: every other car reads against it |
| muscle | heavy, lazy, wild on power | 5.0-5.8 | 275-290 | 31-35 | 0.86-0.93 | 65-75 | 2-6 | 28-38 | laziest turn-in, most roll, most power-on |
| rally | AWD gravel car | 4.3-4.8 | 228-242 | 31-35 | 0.88-0.95 | 52-60 | 10-16 | 14-22 | quickest B-class 0-100, rotates on lift, best on loose |
| kaze | easiest drifter | 5.4-6.0 | 245-260 | 30-33 | 0.90-0.96 | 52-60 | 3-7 | 24-32 | longest slide hold, forgiving catch |
| sturm | rear-engine, fast, traction out | 4.2-4.7 | 275-295 | 28-31 | 0.94-1.00 | 64-74 | 2-8 | 8-20 `?` (1.2) | top speed, brakes, rear bite on exit |
| raijin | AWD sedan, grip | 4.3-4.8 | 250-265 | 30-33 | 0.92-0.98 | 56-64 | 3-7 | 10-20 | high skidpad, neutral, stable at speed |
| formula | downforce car | 3.8-4.3 | 295-310 | 23-26 | 1.12-1.22 | 38-46 | 8-15 | 22-32 | grip rises with speed, nervous on lift, poor off road |
| fujin | prototype, most grip | 2.4-2.9 | 315-330 | 20-23 | 1.30-1.40 | 32-40 | 6-12 `?` (19.1) | 0-8 | highest g, stable at top speed |
| tsumuji | light pop-up roadster, momentum drifter | 8.8-9.8 | 172-185 | 32-35 | 0.92-0.99 | 46-54 | 12-18 | 16-24 | rotates on lift, carries speed through slides |
| sajin | sand buggy | 4.3-4.9 | 182-195 | 34-38 | 0.80-0.87 | 50-58 | 10-16 `?` (24.1) | 14-22 | best on sand and grass, soft, slow on tarmac |

Columns: `t100` 0-100 TCS on; `top` after 60 s flat out; `stop` 100-0 ABS on; `g` best steady skidpad g at 70 km/h; `turn` ms from full steer at 100 km/h to 0.2 rad/s; `lift` peak slip lifting mid corner at 90 km/h, assists on; `pwr` peak slip full throttle mid corner in 2nd, TCS off. Loose-ground rows (`<car>.stock dirt` and on) carry no bands yet: rally and sajin "best on loose" is read across cars on the same ground.

The bus is out (decision O6).
