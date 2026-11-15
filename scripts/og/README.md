# Link-preview card

`public/og.jpg` (1200x630) is `og.html` rendered over `hero.jpg`, a frame of the real game.

```sh
node scripts/og/capture.mjs <port>   # re-shoots hero.jpg from a vite preview of a build on that port
node scripts/og/render.mjs           # og.html + hero.jpg -> public/og.jpg
```

The frame is fixed by the URL: `?debug&at=<circuit point>&pose=<camera x,y,z, look-at x,y,z>` stands the car on the
road and pins the camera, so the same build gives the same picture. The pose is in world metres: when the world kind's
version changes, the spot moves and the pose needs finding again.

## Parked: the pack on a hairpin

The owner wants this one back when the career revamp ships. Four race-kit cars coming out of a Mainland hairpin
towards the camera, pines and the low sun behind them.

- World: `seed=1&world=mainland`, every tab in the same `room`.
- Lead car, the tab that takes the shot: `car=kaze.2.8.4.2.2.1.7.2.2.2.1.2&debug&at=2270&pose=-1186.00,50.19,-1249.75,-1194.00,47.49,-1235.75`
- The other cars are real peers: one more tab each in the same browser context, opened before the lead's, with
  `debug&at=` 2265 (`tsumuji.4.…`), 2259 (`coupe.0.…`) and 2252 (`muscle.6.…`), the same part codes as the lead.
  Launch Chrome with `--disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows`, or the hidden tabs stop sending their cars.
- Left to fix: the road's edge line runs under the end of the title; aim the camera a little further left.
