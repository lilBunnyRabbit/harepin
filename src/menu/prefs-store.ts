import { BUILD_KEY } from "./garage-builds";
import { THEME_KEY } from "../theme/theme";
import { DEFAULT_SETTINGS, parse_settings, type SettingKey, type SettingsState } from "./prefs";

export const SETTINGS_KEY = "harepin:settings";

export function read_saved(): SettingsState {
  try {
    const text = localStorage.getItem(SETTINGS_KEY);
    const played = localStorage.getItem(THEME_KEY) !== null || localStorage.getItem(BUILD_KEY) !== null;
    return parse_settings(text === null ? null : JSON.parse(text), played);
  } catch (error) {
    console.warn("settings: saved settings unreadable", error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function write_saved(state: SettingsState) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("settings: not saved", error);
  }
}

/** URL params win for this load only; the saved copy keeps what the viewer chose. */
function with_overrides(saved: SettingsState, params: URLSearchParams): SettingsState {
  return parse_settings({
    ...saved,
    quality: params.get("quality") ?? saved.quality,
    name: params.get("name") ?? saved.name,
  });
}

export function save_setting<K extends SettingKey>(key: K, value: SettingsState[K]) {
  write_saved({ ...read_saved(), [key]: value });
}

export function load_settings(params = new URLSearchParams(location.search)): SettingsState {
  return with_overrides(read_saved(), params);
}

// Picking a world reloads the page; this one-shot flag lets that load skip the menu and drive straight away.
const DRIVE_KEY = "harepin:drive";

/** Set before a menu pick reloads the page. */
export function mark_drive() {
  try {
    sessionStorage.setItem(DRIVE_KEY, "1");
  } catch {}
}

/** True once after a menu pick reloaded the page. */
export function take_drive(): boolean {
  try {
    const set = sessionStorage.getItem(DRIVE_KEY) !== null;
    sessionStorage.removeItem(DRIVE_KEY);
    return set;
  } catch {
    return false;
  }
}
