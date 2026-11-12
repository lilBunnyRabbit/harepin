import { SLOT_NAMES, type Build } from "../car/build";
import type { Item } from "./garage-items";

/** When the strip's cards rebuild. Car cards carry a rating of each car with the fitted parts, so new parts rebuild them. */
export function strip_key(item: Pick<Item, "id" | "kind" | "count" | "values">, tab: number, build: Build): string {
  const parts = item.kind === "car" ? `:${SLOT_NAMES.map((slot) => build.parts[slot]).join(".")}` : "";
  return `${item.id}:${item.count}:${tab}${parts}${item.values ? `:${item.values.join(".")}` : ""}`;
}
