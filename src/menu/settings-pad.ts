import { axis_value, fit_zone, INNER_MAX, OUTER_MIN } from "../hud/pad-curve";
import { el, icon } from "./setting-rows";
import type { SettingsMenu } from "./page";
import { pad_settings } from "./prefs";
import "./settings-pad.css";

const SVG = "http://www.w3.org/2000/svg";
const CURVE_STEPS = 48;
const DEADZONE_STEP = 1;
const LINEARITY_STEP = 5;

const svg = <K extends keyof SVGElementTagNameMap>(tag: K, class_name: string): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG, tag);
  node.setAttribute("class", class_name);
  return node;
};

export function pad_advanced(m: SettingsMenu): HTMLElement[] {
  const zone = (axis: "steer" | "throttle" | "brake", inner_help: [string, string], outer_help: [string, string]) => {
    const inner = m.value(`pad_${axis}_inner`);
    const outer = m.value(`pad_${axis}_outer`);
    const fit = (i: number, o: number, keep: "inner" | "outer") => {
      const [fi, fo] = fit_zone(i, o, keep);
      inner.set(fi);
      outer.set(fo);
    };
    return [
      m.rows.slider(inner_help[0], inner_help[1], { get: inner.get, set: (value) => fit(value, outer.get(), "inner") }, { step: DEADZONE_STEP, max: INNER_MAX }),
      m.rows.slider(outer_help[0], outer_help[1], { get: outer.get, set: (value) => fit(inner.get(), value, "outer") }, { step: DEADZONE_STEP, min: OUTER_MIN }),
    ];
  };
  const rows = [
    ...zone(
      "steer",
      ["Steering inside deadzone", "Stick travel from centre that steers nothing. Raise it if the car pulls with the stick let go."],
      ["Steering outside deadzone", "Stick travel that already gives full lock. Lower reaches full lock before the stick hits its edge."],
    ),
    m.rows.slider("Steering linearity", "0 is linear: the wheels follow the stick. Higher steers finer near centre and keeps full lock for the edge.", m.value("pad_steer_linearity"), { step: LINEARITY_STEP, unit: "" }),
    ...zone("throttle", ["Throttle inside deadzone", "Right trigger travel that gives no gas."], ["Throttle outside deadzone", "Right trigger travel that already gives full gas."]),
    ...zone("brake", ["Brake inside deadzone", "Left trigger travel that gives no brake."], ["Brake outside deadzone", "Left trigger travel that already gives full brake."]),
    preview(m),
  ];
  let open = false;
  const shown = el("span", "row-link pad-fold");
  const text = el("span", "", "Deadzones, linearity");
  shown.append(text, icon("icon-steer-right"));
  const head = m.rows.action("Advanced controller", "Gamepad deadzones and steering response. Keyboard and touch are not affected.", shown, () => {
    open = !open;
    head.setAttribute("aria-expanded", String(open));
    for (const row of rows) row.hidden = !open;
    m.refresh();
  });
  head.setAttribute("aria-expanded", "false");
  for (const row of rows) row.hidden = true;
  return [head, ...rows];
}

function preview(m: SettingsMenu): HTMLElement {
  const plot = svg("svg", "pad-plot");
  plot.setAttribute("viewBox", "0 0 100 100");
  plot.setAttribute("aria-hidden", "true");
  const frame = svg("rect", "pad-plot-frame");
  for (const [k, v] of [["x", "0"], ["y", "0"], ["width", "100"], ["height", "100"]]) frame.setAttribute(k, v);
  const line = svg("polyline", "pad-plot-line");
  const linear = svg("line", "pad-plot-linear");
  for (const [k, v] of [["x1", "0"], ["y1", "100"], ["x2", "100"], ["y2", "0"]]) linear.setAttribute(k, v);
  const dot = svg("circle", "pad-plot-dot");
  dot.setAttribute("r", "4");
  plot.append(frame, linear, line, dot);

  const meter = (name: string) => {
    const wrap = el("span", "pad-meter");
    const bar = el("i");
    wrap.append(el("small", "", name), bar);
    return [wrap, bar] as const;
  };
  const [gas, gas_bar] = meter("Gas");
  const [brake, brake_bar] = meter("Brake");
  const note = el("small", "pad-note");
  const side = el("div", "pad-side");
  side.append(gas, brake, note);
  const control = el("div", "pad-preview");
  control.append(plot, side);
  const row = m.rows.custom("Response", "The line is the steering curve, the dot is your stick now. The bars are what the triggers give.", control);
  row.classList.add("pad-preview-row");

  let response = pad_settings(m.state());
  let drawn = "";
  let shown = "";
  let running = false;
  const draw = () => {
    if (!row.isConnected || !row.checkVisibility()) {
      running = false;
      return;
    }
    const pad = navigator.getGamepads().find((p) => p?.connected) ?? null;
    const raw = pad?.axes[0] ?? 0;
    const tilt = Math.abs(raw);
    const steer = Math.abs(axis_value(raw, response.steer));
    const throttle = axis_value(pad?.buttons[7]?.value ?? 0, response.throttle);
    const braking = axis_value(pad?.buttons[6]?.value ?? 0, response.brake);
    const now = `${pad ? 1 : 0}|${tilt.toFixed(3)}|${steer.toFixed(3)}|${throttle.toFixed(3)}|${braking.toFixed(3)}`;
    if (now !== shown) {
      shown = now;
      dot.setAttribute("cx", (tilt * 100).toFixed(1));
      dot.setAttribute("cy", (100 - steer * 100).toFixed(1));
      dot.toggleAttribute("data-off", !pad);
      gas_bar.style.setProperty("--fill", `${throttle * 100}%`);
      brake_bar.style.setProperty("--fill", `${braking * 100}%`);
      note.textContent = pad ? `Steer ${Math.round(steer * 100)}%` : "No controller";
    }
    requestAnimationFrame(draw);
  };
  m.sync(() => {
    const state = m.state();
    const key = `${state.pad_steer_inner}|${state.pad_steer_outer}|${state.pad_steer_linearity}|${state.pad_throttle_inner}|${state.pad_throttle_outer}|${state.pad_brake_inner}|${state.pad_brake_outer}`;
    if (key !== drawn) {
      drawn = key;
      response = pad_settings(state);
      const points = Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
        const x = i / CURVE_STEPS;
        return `${(x * 100).toFixed(1)},${(100 - axis_value(x, response.steer) * 100).toFixed(1)}`;
      });
      line.setAttribute("points", points.join(" "));
      shown = "";
    }
    if (!running && row.checkVisibility()) {
      running = true;
      requestAnimationFrame(draw);
    }
  });
  return row;
}
