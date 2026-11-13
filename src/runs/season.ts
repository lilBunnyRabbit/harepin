import { season_number } from "./runs";

export const SEASON_STEP = 15;

export const RewardKind = {
  TINT: "tint",
  TITLE: "title",
} as const;
export type RewardKind = (typeof RewardKind)[keyof typeof RewardKind];

export interface SeasonReward {
  readonly kind: RewardKind;
  readonly id: string;
  readonly label: string;
}

/** Name tag tints: theme tokens by name, so a peer's tag reads in the viewer's own theme. */
export const TINTS = [
  { id: "accent", label: "Accent" },
  { id: "info", label: "Info" },
  { id: "secondary", label: "Secondary" },
  { id: "cottontail", label: "Cottontail" },
] as const;

export const TITLES = [
  { id: "regular", label: "Regular" },
  { id: "contender", label: "Contender" },
  { id: "ace", label: "Ace" },
  { id: "headliner", label: "Headliner" },
] as const;

const tint = (i: number): SeasonReward => ({ kind: RewardKind.TINT, ...TINTS[i] });
const title = (i: number): SeasonReward => ({ kind: RewardKind.TITLE, ...TITLES[i] });

/** One reward a step, the same every season; a fixed set, as `DECALS` never grows per season. */
export const SEASON_TRACK: readonly SeasonReward[] = [tint(0), title(0), tint(1), title(1), tint(2), title(2), tint(3), title(3)];

export const SEASON_MAX = SEASON_TRACK.length * SEASON_STEP;

export const season_steps = (stars: number): number => Math.min(SEASON_TRACK.length, Math.floor(Math.max(0, stars) / SEASON_STEP));

export function next_step(stars: number): { reward: SeasonReward; at: number } | null {
  const steps = season_steps(stars);
  return steps < SEASON_TRACK.length ? { reward: SEASON_TRACK[steps], at: (steps + 1) * SEASON_STEP } : null;
}

/**
 * What a reward is kept as once reached: a tint by its id, kept for good; a title with its season's number, `ace.1`,
 * so each season's titles are new.
 */
export const reward_code = (reward: SeasonReward, season: string): string => (reward.kind === RewardKind.TITLE ? `${reward.id}.${season_number(season)}` : reward.id);

export const reached = (stars: number, season: string): string[] => SEASON_TRACK.slice(0, season_steps(stars)).map((reward) => reward_code(reward, season));

const TITLE_CODE = /^([a-z]+)\.([1-9]\d{0,3})$/;

export function clean_tint(raw: unknown): string | null {
  return typeof raw === "string" && TINTS.some((t) => t.id === raw) ? raw : null;
}

export function clean_title(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = TITLE_CODE.exec(raw);
  return match && TITLES.some((t) => t.id === match[1]) ? raw : null;
}

export function title_text(code: string): string | null {
  const match = TITLE_CODE.exec(code);
  const def = match && TITLES.find((t) => t.id === match[1]);
  return def ? `S${match[2]} ${def.label}` : null;
}

export const tint_label = (id: string): string => TINTS.find((t) => t.id === id)?.label ?? id;

// A type alias, not an interface: it rides in `Hello`, which trystero's DataPayload needs index-signature compatible.
export type NameTag = { title?: string; tint?: string };

export function clean_tag(raw: unknown): NameTag | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { title, tint } = raw as Record<string, unknown>;
  const tag: NameTag = {};
  const clean = { title: clean_title(title), tint: clean_tint(tint) };
  if (clean.title !== null) tag.title = clean.title;
  if (clean.tint !== null) tag.tint = clean.tint;
  return tag.title || tag.tint ? tag : null;
}
