# worldgen/

- Runs in a Web Worker: no DOM, no THREE, no imports from `render/`, `menu/` or `worlds/`.
- Output is keyed by `WORLD_VERSION` / `SKY_VERSION` (`types.ts`): saved records, ghosts and peers' maps all depend on it. A change to what `generate_world` returns bumps the version; a speed-up must not change it.
- Prove a speed-up identical with a hash of the generated arrays (and of `build_chunks` output for meshing) over several seeds before and after.
- Meshing is mesh-only and not version-keyed, but road draping keeps its crossing order: that ordering is what keeps T-junctions crack-free.
