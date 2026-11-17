import type { SavedPick } from "./world-pick";
import { came_from, travel_of, type Travel } from "./travel";

// Imports nothing with CSS, which would load ahead of main.ts's own order: the backdrop's look sits in index.html.

/** The travel this page load is. A reload or back/forward keeps the first referrer, which no longer names the map left. */
export function travel_here(params: URLSearchParams, saved: SavedPick): Travel | null {
  const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  const before = nav?.type === "navigate" ? came_from(document.referrer, new URL(location.href)) : null;
  return travel_of(params, before, saved);
}

/** Puts the destination's picture behind the loading screen while the game bundle arrives; main.ts lays the briefing over it. */
export function show_backdrop(loading: HTMLElement, travel: Travel) {
  loading.style.setProperty("--picture", `url("${import.meta.env.BASE_URL}menu/${travel.map.kind}.webp")`);
  loading.dataset.travel = "";
}
