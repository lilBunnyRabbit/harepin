export const FALLBACK = "These settings can't build a drivable world; showing the plain map";

/** What a load tells the player when it is not on the map it was sent to; null when it is. */
export function map_note(problem: "newer" | "bad" | null, fallback: boolean): string | null {
  if (problem === "newer") return "This map was made in a newer Harepin: update to drive it";
  if (problem === "bad") return "That link's map is not a map code; showing the room's map";
  return fallback ? FALLBACK : null;
}
