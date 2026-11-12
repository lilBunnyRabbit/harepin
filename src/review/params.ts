// Apart from the catalog, so the boot entry reads them without pulling in every world kind.
export const SHOWCASE_PARAM = "showcase";
export const VIEW_PARAM = "view";
export const REPLAY_PARAM = "replay";
export const TIME_PARAM = "t";

export const review_wanted = (params: URLSearchParams) => params.has(VIEW_PARAM) || params.has(REPLAY_PARAM);
