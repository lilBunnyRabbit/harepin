import { NOT_THIS_CAR } from "../../net/lobby";
import type { ReadyStatus } from "../../net/ready";

export interface MeetDriver {
  key: string;
  name: string;
  initial: string;
  you: boolean;
  ready: boolean;
}

const YOU = "you";

function driver(name: string, at: number, ready: boolean, own: string): MeetDriver {
  const you = name === YOU;
  const shown = you ? own : name;
  return { key: `${ready ? "r" : "w"}${at}`, name: shown, initial: [...shown.trim()][0]?.toUpperCase() ?? "?", you, ready };
}

export function meet_drivers(status: Pick<ReadyStatus, "names" | "waiting">, own: string): MeetDriver[] {
  const all = [...status.names.map((name, at) => driver(name, at, true, own)), ...status.waiting.map((name, at) => driver(name, at, false, own))];
  return all.sort((a, b) => Number(b.you) - Number(a.you));
}

export function meet_note(status: ReadyStatus, busy: boolean, left_out: boolean): string {
  if (busy) return "The race is on.";
  if (left_out) return NOT_THIS_CAR;
  if (status.total <= 1) return status.electing ? "Looking for players in the room…" : "You're alone here: it starts at once.";
  return `${status.names.length} of ${status.total} ready. It starts when everyone is.${status.left_out ? " You sit this one out: not raced in your car." : ""}`;
}
