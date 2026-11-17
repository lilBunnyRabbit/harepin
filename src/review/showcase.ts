import { SHOWCASE_PARAM, UI_SHEET } from "./params";

if (new URLSearchParams(location.search).get(SHOWCASE_PARAM) === UI_SHEET) await import("./ui-sheet");
else await import("./showcase-models");
