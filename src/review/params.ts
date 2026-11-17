// Apart from the catalog, so the boot entry reads them without pulling in every world kind. The pages exist only in a
// `vite build --mode review` (or dev) build: import sites test `REVIEW_BUILD` inline, so a production build drops them.
export const REVIEW_BUILD = import.meta.env.MODE === "review" || import.meta.env.DEV;
export const SHOWCASE_PARAM = "showcase";
/** `?showcase=ui`: every shared menu piece in every state, on a page frame. The other sheets are model renders (`catalog.ts`). */
export const UI_SHEET = "ui";
/** `?release=card|page|updates`: the updated card, the story page or the Updates page, wearing the draft story. */
export const RELEASE_PARAM = "release";
export const VIEW_PARAM = "view";
export const REPLAY_PARAM = "replay";
export const TIME_PARAM = "t";
/** `?tow=0..1&towlook=icon|edge|line`: the speedometer's slipstream cue at a fixed tow, a mock until `Car.tow` is on master. */
export const TOW_PARAM = "tow";
export const TOW_LOOK_PARAM = "towlook";

export const review_wanted = (params: URLSearchParams) => REVIEW_BUILD && (params.has(VIEW_PARAM) || params.has(REPLAY_PARAM));

export const replay_of = (params: URLSearchParams) => (REVIEW_BUILD ? params.get(REPLAY_PARAM) : null);
