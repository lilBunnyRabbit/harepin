// Apart from the catalog, so the boot entry reads them without pulling in every world kind. The pages exist only in a
// `vite build --mode review` (or dev) build: import sites test `REVIEW_BUILD` inline, so a production build drops them.
export const REVIEW_BUILD = import.meta.env.MODE === "review" || import.meta.env.DEV;
export const SHOWCASE_PARAM = "showcase";
export const VIEW_PARAM = "view";
export const REPLAY_PARAM = "replay";
export const TIME_PARAM = "t";

export const review_wanted = (params: URLSearchParams) => REVIEW_BUILD && (params.has(VIEW_PARAM) || params.has(REPLAY_PARAM));

export const replay_of = (params: URLSearchParams) => (REVIEW_BUILD ? params.get(REPLAY_PARAM) : null);
