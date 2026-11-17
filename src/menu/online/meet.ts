import { NOT_THIS_CAR } from "../../net/lobby";
import type { ReadyStatus } from "../../net/ready";

export const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? "?";

export function meet_note(status: ReadyStatus, busy: boolean, left_out: boolean): string {
  if (busy) return "The race is on.";
  if (left_out) return NOT_THIS_CAR;
  if (status.total <= 1) return status.electing ? "Looking for players in the room…" : "You're alone here: it starts at once.";
  return `${status.names.length} of ${status.total} ready. It starts when everyone is.${status.left_out ? " You sit this one out: not raced in your car." : ""}`;
}
