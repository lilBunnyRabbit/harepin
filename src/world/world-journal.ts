import type { Tile } from "../worldgen/tiles";
import type { Solid } from "../worldgen/types";
import type { LaidPad } from "./drawn-lift";
import type { World } from "./world";

export type WorldOp =
  | { type: "tile"; index: number; tile: Tile }
  | { type: "drop"; index: number }
  | { type: "plant"; index: number; solids: readonly Solid[] }
  | { type: "unplant"; index: number }
  | { type: "place"; id: number; solids: readonly Solid[] }
  | { type: "unplace"; id: number }
  | { type: "lay"; id: number; pad: LaidPad }
  | { type: "unlay"; id: number };

/** A copy of the world built from the same plan elsewhere (the sim worker) follows these changes in order. */
export class WorldJournal {
  private held: WorldOp[] = [];
  private sink: ((op: WorldOp) => void) | null = null;
  private next = 0;

  /** Every op held so far, then each one as it is made. */
  pipe(sink: (op: WorldOp) => void) {
    for (const op of this.held) sink(op);
    this.held = [];
    this.sink = sink;
  }

  tile(index: number, tile: Tile) {
    this.push({ type: "tile", index, tile });
  }

  drop(index: number) {
    this.push({ type: "drop", index });
  }

  plant(index: number, solids: readonly Solid[]) {
    this.push({ type: "plant", index, solids });
  }

  unplant(index: number) {
    this.push({ type: "unplant", index });
  }

  place(solids: readonly Solid[]): number {
    const id = this.next++;
    this.push({ type: "place", id, solids });
    return id;
  }

  unplace(id: number) {
    this.push({ type: "unplace", id });
  }

  lay(pad: LaidPad): number {
    const id = this.next++;
    this.push({ type: "lay", id, pad });
    return id;
  }

  unlay(id: number) {
    this.push({ type: "unlay", id });
  }

  private push(op: WorldOp) {
    if (this.sink) this.sink(op);
    else this.held.push(op);
  }
}

export class WorldReplay {
  private readonly undo = new Map<number, () => void>();

  constructor(private readonly world: World) {}

  apply(op: WorldOp) {
    const { world, undo } = this;
    if (op.type === "tile") world.tiles.add(op.index, op.tile);
    else if (op.type === "drop") world.tiles.drop(op.index);
    else if (op.type === "plant") world.plant(op.index, op.solids);
    else if (op.type === "unplant") world.unplant(op.index);
    else if (op.type === "place") undo.set(op.id, world.place(op.solids));
    else if (op.type === "lay") undo.set(op.id, world.lay(op.pad));
    else {
      undo.get(op.id)?.();
      undo.delete(op.id);
    }
  }
}
