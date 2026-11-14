import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { PLAIN_CARS, REWARD_CARS } from "../career/rewards";
import { ChangeKind, DRAFT_HIGHLIGHTS, TEASE, type Highlight, type Release } from "../changelog";
import { parse_version_file } from "../version";
import Changelog from "./Changelog.svelte";
import ReleaseStories from "./ReleaseStories.svelte";
import ReleaseStory from "./ReleaseStory.svelte";
import UpdatedCard from "./UpdatedCard.svelte";
import { story_of } from "./release-story";
import { UpdateView } from "./update-view.svelte";

const { NEW, IMPROVED } = ChangeKind;
const release = (highlights?: Highlight[]): Release => ({ version: "9.9.9", date: "2026-11-14", title: "Big one", changes: [{ kind: NEW, text: "One" }], highlights });
const HIGHLIGHTS: Highlight[] = [
  { kind: NEW, title: "Two new cars", text: "Lede." },
  { kind: NEW, title: "Here", text: "A car this build has.", car: "coupe" },
  { kind: NEW, title: "Later", text: "A car still to land.", car: "not-a-car" },
  { kind: IMPROVED, title: "Restyled", text: "Every body.", was: true },
  { kind: TEASE, title: "Waiting", text: "Win it.", car: REWARD_CARS[0] },
  { kind: NEW, title: "Towns", text: "Streets." },
  { kind: NEW, title: "Lights", text: "On any car." },
];
const card = (releases: Release[]) => render(UpdatedCard, { props: { version: "9.9.9", since: "From v9.9.8", releases, onnotes: () => undefined, onclosed: () => undefined } }).body;

test("a release without highlights has no story", () => {
  expect(story_of(release())).toBeNull();
  expect(story_of(release([]))).toBeNull();
});

test("a story groups car cards under their headline and leaves the rest for also new", () => {
  const story = story_of(release(HIGHLIGHTS));
  expect(story?.blocks.map((block) => block.type)).toEqual(["cars", "pairs", "tease", "also"]);
  const [cars, pairs, , also] = story?.blocks ?? [];
  expect(cars.type === "cars" && cars.cards.map((c) => c.car)).toEqual(["coupe", null]);
  expect(pairs.type === "pairs" && pairs.cars.every((car) => PLAIN_CARS.includes(car))).toBe(true);
  expect(also.type === "also" && also.items.map((item) => item.title)).toEqual(["Towns", "Lights"]);
  expect(story?.tops.map((top) => top.title)).toEqual(["Two new cars", "Restyled", "Waiting"]);
});

test("the teased car is never among the lit ones", () => {
  const story = story_of(release([...HIGHLIGHTS, { kind: NEW, title: "Leak", text: "The same car as a card.", car: REWARD_CARS[0] }]));
  expect(story?.tease).toBe(REWARD_CARS[0]);
  expect(story?.banner).not.toContain(REWARD_CARS[0]);
  expect(story?.lineup).not.toContain(REWARD_CARS[0]);
  expect(story?.banner[0]).toBe("coupe");
  expect(story?.blocks.flatMap((block) => (block.type === "cars" ? block.cards.map((c) => c.car) : []))).not.toContain(REWARD_CARS[0]);
});

test("the draft story reads as a story", () => {
  const story = story_of(release(DRAFT_HIGHLIGHTS));
  expect(story?.tops.length).toBe(3);
  expect(story?.banner.length).toBe(2);
});

test("the updated card leads with the story's headlines, and stays a list of notes without one", () => {
  const rich = card([release(HIGHLIGHTS)]);
  expect(rich).toMatch(/<h2[^>]*>Big one</);
  expect(rich).toContain("Updated to v9.9.9 · from v9.9.8");
  expect(rich).toContain("See what's new");
  expect(rich).toMatch(/>Restyled\.<\/b> Every body\./);
  expect(rich).not.toContain("Towns");
  const plain = card([release()]);
  expect(plain).toMatch(/<h2[^>]*>Updated to v9.9.9</);
  expect(plain).toContain("Full notes");
  expect(plain).not.toContain("See what's new");
});

test("the story page holds a place for a car still to land and lazy-loads the before pictures", () => {
  const story = story_of(release(HIGHLIGHTS));
  if (!story) throw new Error("no story");
  const { body } = render(ReleaseStory, { props: { release: release(HIGHLIGHTS), story } });
  expect(body).toContain("Coming soon");
  expect(body).toMatch(/<img[^>]*src="[^"]*release\/before\/hatch\.webp"[^>]*loading="lazy"/);
  expect(body).toContain("Also new");
  expect(body).toMatch(/data-outline/);
});

test("a build that knows no highlights still reads version.json", () => {
  const file = { version: "9.9.9", commit: "abc1234", built: 1, notes: [release(HIGHLIGHTS)] };
  expect(parse_version_file(JSON.parse(JSON.stringify(file)))?.notes[0].changes.length).toBe(1);
});

const versioned = (version: string, highlights?: Highlight[]): Release => ({ ...release(highlights), version, title: `Release ${version}` });
const updates = (releases: Release[], reading: string | null = null) => {
  const view = new UpdateView();
  view.reading = reading;
  return render(Changelog, { props: { view, build: { version: "9.9.9", commit: "abc1234", built: 0 }, onapply: () => undefined, releases } }).body;
};

test("the Updates page lists every release with a story, the newest one leading with its banner", () => {
  const { body } = render(ReleaseStories, { props: { releases: [versioned("9.9.9"), versioned("9.9.8", HIGHLIGHTS), versioned("9.9.7"), versioned("9.9.6", HIGHLIGHTS)], onopen: () => undefined } });
  expect(body.match(/See what's new</g)?.length).toBe(2);
  expect(body).toMatch(/<h3[^>]*>Release 9\.9\.8</);
  expect(body).toMatch(/>Two new cars\.<\/b> Lede\./);
  expect(body).toMatch(/aria-label="See what[^"]*new in v9.9.6"/);
  expect(body).not.toContain("9.9.7");
  expect(body.match(/class="banner svelte-/g)?.length).toBe(1);
});

test("the Updates page shows the list until a story is open, then that story alone", () => {
  const releases = [versioned("9.9.9", HIGHLIGHTS), versioned("9.9.8", HIGHLIGHTS), versioned("9.9.7")];
  const list = updates(releases);
  expect(list).toContain("See what's new");
  expect(list).toContain("You have v9.9.9");
  expect(list).not.toContain("Also new");
  const older = updates(releases, "9.9.8");
  expect(older).toContain("All updates");
  expect(older).toMatch(/<h3[^>]*>Release 9\.9\.8</);
  expect(older).not.toContain("You have v9.9.9");
  expect(updates([], "9.9.8")).not.toContain("All updates");
  expect(render(ReleaseStories, { props: { releases: [versioned("9.9.7")], onopen: () => undefined } }).body).not.toContain("See what's new");
});
