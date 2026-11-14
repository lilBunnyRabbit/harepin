# Lab sessions

Each owner paste, committed as `<pack>.r<rev>.<yyyy-mm-dd>.txt` (decision O4), the export block exactly as copied. Compare two:

```sh
bun scripts/lab.ts diff docs/lab/sessions/<old>.txt docs/lab/sessions/<new>.txt
```

Per trial id: `spec#` same or moved (moved: the physics changed between sessions), ` m` metric deltas, ` a` rating changes (`!` when bigger than the anchor spread: the widest rating gap between two runs of one spec on one lane in either session), ` in` input share deltas (`lock`, `rev`, `thr`: a rating that moved with a big input change is the driver).
