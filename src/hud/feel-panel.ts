import type { SettingKey, SettingsState } from "../menu/prefs";
import { FEEL_TESTS, feel_car, type FeelTest } from "./feel-tests";
import "./feel-panel.css";

export interface FeelHost {
  set: <K extends SettingKey>(key: K, value: SettingsState[K]) => void;
  use_car: (code: string) => void;
  respawn: () => void;
  /** With the steering assist off, a drift's key into the turn reaches full lock and the drift bites (`Car.drift_full_lock`); unchecked is the old feel. */
  drift_full_lock: (on: boolean) => void;
}

function fold(label: string, open: boolean): [HTMLDetailsElement, HTMLElement] {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = label;
  summary.addEventListener("click", () => summary.blur());
  details.open = open;
  details.append(summary);
  return [details, summary];
}

export function feel_panel(host: FeelHost) {
  const root = document.createElement("div");
  root.className = "feel-panel";
  const [strip, strip_label] = fold("Feel tests", true);
  strip.className = "feel-strip";
  const [note, note_label] = fold("", true);
  note.className = "feel-note";
  note.hidden = true;
  const text = document.createElement("p");
  note.append(text);
  // A press must leave focus where it was, so Space and the arrows keep driving the car.
  root.addEventListener("mousedown", (event) => event.preventDefault());

  const buttons = FEEL_TESTS.map((test) => {
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.textContent = test.label;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      button.blur();
      apply(test, button);
    });
    return button;
  });
  const apply = (test: FeelTest, pressed: HTMLButtonElement) => {
    host.use_car(feel_car(test.car));
    for (const key of Object.keys(test.settings) as SettingKey[]) host.set(key, test.settings[key] as never);
    if (test.respawn) host.respawn();
    for (const button of buttons) button.setAttribute("aria-pressed", String(button === pressed));
    strip_label.textContent = `Feel: ${test.label}`;
    strip.open = false;
    note_label.textContent = "Try / feel for";
    text.textContent = `Try: ${test.try}. Feel for: ${test.feel}.`;
    note.hidden = false;
    note.open = true;
  };
  strip.append(...buttons);
  const toggle = document.createElement("label");
  toggle.className = "feel-toggle";
  const full_lock = document.createElement("input");
  full_lock.type = "checkbox";
  full_lock.checked = true;
  full_lock.tabIndex = -1;
  full_lock.addEventListener("change", () => {
    host.drift_full_lock(full_lock.checked);
    // A focused checkbox counts as typing, so driving keys would stop and Space would toggle it.
    full_lock.blur();
  });
  toggle.append(full_lock, "Full lock in drift");
  root.append(strip, note, toggle);
  document.body.append(root);
}
