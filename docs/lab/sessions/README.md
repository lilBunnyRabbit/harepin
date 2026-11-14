# Lab sessions

Each owner paste, committed as `<pack>.r<rev>.<yyyy-mm-dd>.txt` (decision O4), the export block exactly as copied. Compare two:

```sh
bun scripts/lab.ts diff docs/lab/sessions/<old>.txt docs/lab/sessions/<new>.txt
```

Append the output of `bun scripts/lab.ts <pack>` (run on the commit the owner drove) under the paste: its ` sim` lines put a `(sim ±n)` beside each metric delta, so an owner delta the sim also shows is the car and one it does not is the driver.

Per trial id: `spec#` same or moved (moved: the physics changed between sessions), ` m` metric deltas, ` a` rating changes, pick answers as `old->new` text (`!` when bigger than the anchor spread: the widest rating gap between two runs of one spec on one lane in either session), ` in` input share deltas (`lock`, `rev`, `thr`: a rating that moved with a big input change is the driver).
