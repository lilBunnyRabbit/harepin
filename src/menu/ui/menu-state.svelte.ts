import type { Stars } from "../../career/career";
import type { Menu } from "../page";
import { DEFAULT_SETTINGS, type SettingKey, type SettingsState } from "../prefs";

/**
 * Rune view of the state the vanilla menu still owns. The menu replaces `prefs` and career stars with new objects
 * on change, so `$state.raw` plus a pull on every refresh is enough: an unchanged reference wakes nothing.
 */
export class MenuState {
  prefs = $state.raw<SettingsState>(DEFAULT_SETTINGS);
  stars = $state.raw<Stars>({});
  car = $state("");
  private tick = $state(0);

  constructor(private readonly menu: Menu) {
    this.pull();
  }

  /** Reads a host getter so a `$derived` over it reruns on every refresh; equal results stop there. */
  live<T>(read: () => T): T {
    void this.tick;
    return read();
  }

  set<K extends SettingKey>(key: K, value: SettingsState[K]) {
    this.menu.set(key, value);
  }

  readonly pull = () => {
    this.prefs = this.menu.state();
    this.stars = this.menu.host.career.stars;
    this.car = this.menu.host.car_code();
    this.tick++;
  };
}
