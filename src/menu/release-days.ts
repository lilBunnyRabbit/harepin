import { ChangeKind, type Release } from "../changelog";
import { compare_versions, releases_since } from "../version";

export interface ReleaseDay {
  /** YYYY-MM-DD */
  date: string;
  releases: Release[];
}

export interface Tally {
  kind: ChangeKind;
  count: number;
}

const DAY_MS = 86_400_000;
const DAY_FORMAT = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const day_number = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const local_day = (now: Date) => Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);

/** Newest day first, newest version first within a day: a release dated out of version order still lands on its own day. */
export function release_days(releases: readonly Release[]): ReleaseDay[] {
  const days = new Map<string, Release[]>();
  for (const release of releases) {
    const day = days.get(release.date);
    if (day) day.push(release);
    else days.set(release.date, [release]);
  }
  return [...days]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({ date, releases: list.sort((a, b) => compare_versions(b.version, a.version)) }));
}

/** "Today", "Yesterday", else the weekday and date ("Sat 14 Nov"). */
export function day_label(date: string, now: Date): string {
  const ago = local_day(now) - day_number(date);
  if (ago === 0) return "Today";
  if (ago === 1) return "Yesterday";
  return DAY_FORMAT.format(new Date(`${date}T00:00:00Z`)).replace(",", "");
}

export function short_date(date: string): string {
  return DAY_FORMAT.format(new Date(`${date}T00:00:00Z`)).replace(",", "");
}

/** Change counts by kind, in the order the notes list them, kinds with none left out. */
export function tally(release: Release): Tally[] {
  return Object.values(ChangeKind).flatMap((kind) => {
    const count = release.changes.filter((change) => change.kind === kind).length;
    return count ? [{ kind, count }] : [];
  });
}

export interface Timeline {
  latest: Release | null;
  /** Every release but the latest, by day. */
  days: ReleaseDay[];
  /** Versions newer than the one the player last ran. */
  fresh: ReadonlySet<string>;
  /** The newest release the player had already seen, when some came after it: where "since you last played" ends. */
  seen: Release | null;
}

export function timeline_of(releases: readonly Release[], seen: string | null, running: string): Timeline {
  const [latest = null, ...rest] = release_days(releases).flatMap((day) => day.releases);
  const fresh = new Set(releases_since([...releases], seen, running).map((release) => release.version));
  const last = fresh.size ? (rest.find((release) => !fresh.has(release.version)) ?? null) : null;
  return { latest, days: release_days(rest), fresh, seen: last };
}
