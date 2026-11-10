# worldgen/

- Runs in a Web Worker: no DOM, no THREE, no imports from `render/`, `menu/` or `worlds/`.
- Output is keyed by `WORLD_VERSION` / `SKY_VERSION` (`types.ts`): saved records, ghosts and peers' maps all depend on it. A change to what `generate_world` returns bumps the version; a speed-up must not change it.
- Prove a speed-up identical with `bun scripts/golden.ts --check`: it digests every part of the generated data, the meshes and the map for island seeds 0-19, sky 0-9 and desert 0-9 (`GOLDEN_SEEDS`) against `scripts/golden/`. A change meant to alter output reruns `bun scripts/golden.ts` and commits the goldens with it.
- Timing: one `bun scripts/proof.ts --no-drive --jobs 1` run (gen and stage times per seed; parallel workers inflate them). Release: `bun scripts/proof.ts` with drives.
- Meshing is mesh-only and not version-keyed, but road draping keeps its crossing order: that ordering is what keeps T-junctions crack-free.
