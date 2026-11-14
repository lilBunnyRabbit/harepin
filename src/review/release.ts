import { mount } from "svelte";
import { CHANGELOG, DRAFT_HIGHLIGHTS, type Release } from "../changelog";
import ReleaseStory from "../menu/ReleaseStory.svelte";
import UpdatedCard from "../menu/UpdatedCard.svelte";
import { story_of } from "../menu/release-story";
import { RELEASE_PARAM } from "./params";
import "../style.css";
import "../menu/settings.css";

// From the review chunk, not a CSS import, so none of it reaches the game's stylesheet.
const PAGE_CSS = `
html[data-review] body > :not(.review-release, dialog) { display: none !important; }
html[data-review], html[data-review] body { overflow: auto; height: auto; background: var(--background); color: var(--foreground); }
.review-release { box-sizing: border-box; width: min(920px, 100%); margin: 0 auto; padding: var(--space-6) var(--inset); font-size: var(--text-md); }`;

const root = document.documentElement;
root.dataset.review = "busy";
document.getElementById("loading")?.remove();
document.head.append(Object.assign(document.createElement("style"), { textContent: PAGE_CSS }));
await document.fonts.ready;

// The running release with the draft story on it, unless it already carries one.
const release: Release = CHANGELOG[0].highlights ? CHANGELOG[0] : { ...CHANGELOG[0], title: "Fresh metal", highlights: DRAFT_HIGHLIGHTS };
const target = document.createElement("div");
target.className = "review-release";
document.body.append(target);
const story = story_of(release);
if (new URLSearchParams(location.search).get(RELEASE_PARAM) === "page" && story) mount(ReleaseStory, { target, props: { release, story } });
else mount(UpdatedCard, { target, props: { version: release.version, since: "From v0.41.0", releases: [release], onnotes: () => undefined, onclosed: () => undefined } });
root.dataset.review = "shown";
