# worldgen/

- Runs in a Web Worker: no DOM, no THREE, no imports from `render/`, `menu/` or `worlds/` (tests may load `car/` and `world/` to drive what they generate).
- Output is keyed by each kind's `version` in `kinds/<kind>.ts` (the island's is `WORLD_VERSION`, the sky's `SKY_VERSION`, in `types.ts`): saved records, ghosts and peers' maps all depend on it. A change to what `generate_world` returns for a kind bumps that kind's version; a speed-up must not change it.
- Prove a speed-up identical with `bun scripts/golden.ts --check`: it digests every part of the generated data, the meshes and the map for island seeds 0-19, mainland 0-2 and 0-9 of every other kind (`GOLDEN_SEEDS` in `scripts/proof/golden-file.ts`) against `scripts/golden/`. A change meant to alter output reruns `bun scripts/golden.ts` and commits the goldens with it.
- Timing: one `bun scripts/proof.ts --no-drive --jobs 1` run (gen and stage times per seed; parallel workers inflate them). Release: `bun scripts/proof.ts` with drives.
- Meshing is mesh-only and not version-keyed, but road draping keeps its crossing order: that ordering is what keeps T-junctions crack-free.
