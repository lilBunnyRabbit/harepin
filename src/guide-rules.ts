// Settings saved before the flag existed, a stored theme or a stored build all mean a player who has been here before.
export function guide_seen_on_load(raw: unknown, played: boolean): boolean {
  if (typeof raw !== "object" || raw === null) return played;
  const seen = (raw as Record<string, unknown>).guide_seen;
  return typeof seen === "boolean" ? seen : true;
}

export const AidPreset = {
  EASY: "easy",
  BALANCED: "balanced",
  PRO: "pro",
} as const;
export type AidPreset = (typeof AidPreset)[keyof typeof AidPreset];

export interface Aids {
  tcs: boolean;
  abs: boolean;
  assist: boolean;
  auto: boolean;
}

const PRESET_AIDS: Record<AidPreset, Aids> = {
  easy: { tcs: true, abs: true, assist: true, auto: true },
  balanced: { tcs: true, abs: true, assist: false, auto: true },
  pro: { tcs: false, abs: false, assist: false, auto: false },
};

/** Touch has no shift buttons, so Pro keeps the automatic gearbox there. */
export function preset_aids(preset: AidPreset, touch: boolean): Aids {
  const aids = PRESET_AIDS[preset];
  return touch && preset === AidPreset.PRO ? { ...aids, auto: true } : aids;
}

export function preset_of(aids: Aids, touch: boolean): AidPreset | null {
  const same = (a: Aids, b: Aids) => a.tcs === b.tcs && a.abs === b.abs && a.assist === b.assist && a.auto === b.auto;
  return Object.values(AidPreset).find((preset) => same(preset_aids(preset, touch), aids)) ?? null;
}

const ROLLED = /^Rolled (\d+)$/;

export function rolled_name(taken: readonly string[]): string {
  const used = new Set(taken.map((name) => Number(ROLLED.exec(name)?.[1])));
  let n = 1;
  while (used.has(n)) n++;
  return `Rolled ${n}`;
}

const ADJECTIVES = ["Swift", "Fuzzy", "Lucky", "Bouncy", "Sly", "Brave", "Zippy", "Mellow"];

export function random_name(not = "", pick = Math.random): string {
  const choices = ADJECTIVES.map((word) => `${word} Bunny`).filter((name) => name !== not);
  return choices[Math.floor(pick() * choices.length)];
}
