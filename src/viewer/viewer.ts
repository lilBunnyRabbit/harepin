import { mount } from "svelte";
import { DEFAULT_BUILD } from "../car/build";
import { dark } from "../theme/palette";
import CarViewer from "./CarViewer.svelte";
import { snap_cam } from "./orbit";
import { Stage } from "./stage";
import { filled_view, Light, LIGHT_THEMES, read_asked } from "./view-state";
import { Viewer } from "./viewer.svelte";
import "../menu/settings.css";
import "../style.css";

const params = new URLSearchParams(location.search);
const asked = read_asked(params, DEFAULT_BUILD.car);
const light = asked.view.light;
// A link asking for the other light reloads once in that theme; a link that names a theme keeps it.
if (light && (light === Light.DUSK) !== dark && !params.has("theme")) {
  const url = new URL(location.href);
  url.searchParams.set("theme", LIGHT_THEMES[light]);
  location.replace(url);
} else {
  document.getElementById("loading")?.remove();
  await document.fonts.ready;
  const stage = new Stage(params);
  const viewer = new Viewer(stage, asked, (frame, aspect) => filled_view(asked.view, snap_cam("3/4", frame, aspect), dark ? Light.DUSK : Light.DAY, DEFAULT_BUILD.paint));
  const target = document.createElement("div");
  target.className = "cars-root";
  document.body.append(target);
  mount(CarViewer, { target, props: { viewer } });
}
