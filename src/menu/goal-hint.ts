import type { Goal } from "../goals/goals";
import { keys_text, type Bindings } from "../hud/bindings";

export function hint_of(goal: Goal, bindings: Bindings): string {
  const keys = goal.key ? keys_text(bindings[goal.key]) : "";
  return goal.hint.replace("{key}", keys || "its key");
}
