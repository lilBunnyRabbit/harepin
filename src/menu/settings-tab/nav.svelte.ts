import { getContext, setContext, tick, type Snippet } from "svelte";
import { DEFAULT_SETTINGS, type SettingKey, type SettingsState } from "../prefs";
import { CHANGES, DEEP, SECTIONS, list_help } from "./sections";

export interface Help {
  title: string;
  text: () => string;
  visual?: Snippet;
}

interface Sub {
  label: string;
  parent: string | null;
  keys: readonly SettingKey[];
  help: (state: SettingsState) => string;
}

type Set = <K extends SettingKey>(key: K, value: SettingsState[K]) => void;

const DEEP_HELP: Record<string, (state: SettingsState) => string> = {
  creator: () => "Roll colours, keep the ones you like, then name and save it.",
  themes: () => "Themes you made. Pick one with Theme on Display.",
  keys: (state) => list_help(state.bindings),
  bindings: () => "Pick an action, then press its new key or pad button. Taking one from another action leaves it the rest.",
};

const SUBS = new Map<string, Sub>([
  ...SECTIONS.map(({ id, label, keys }) => [id, { label, parent: null, keys, help: () => "" }] as const),
  ...DEEP.map(({ id, label, parent }) => [id, { label, parent, keys: [], help: DEEP_HELP[id] }] as const),
  [CHANGES, { label: "What's new", parent: null, keys: [], help: () => "Every release, newest first." }],
]);

export class SettingsNav {
  sub = $state("graphics");
  help = $state.raw<Help | null>(null);
  readonly lists: Record<string, HTMLElement | undefined> = {};
  private readonly helps = new WeakMap<Element, Help>();

  constructor(
    private readonly set: Set,
    private readonly state: () => SettingsState,
  ) {}

  get list(): HTMLElement | null {
    return this.lists[this.sub] ?? null;
  }

  has(id: string): boolean {
    return SUBS.has(id);
  }

  label(id: string): string {
    return SUBS.get(id)?.label ?? "";
  }

  parent(id = this.sub): string | null {
    return SUBS.get(id)?.parent ?? null;
  }

  keys(id = this.sub): readonly SettingKey[] {
    return SUBS.get(id)?.keys ?? [];
  }

  top(id = this.sub): string {
    return this.parent(id) ?? id;
  }

  register(row: Element, help: Help) {
    this.helps.set(row, help);
  }

  focus(help: Help) {
    this.help = help;
  }

  show(id: string) {
    const sub = SUBS.get(id);
    if (!sub) return;
    this.sub = id;
    void tick().then(() => {
      if (this.sub !== id) return;
      this.list?.parentElement?.scrollTo({ top: 0 });
      const first = this.list?.querySelector("[data-set-row]");
      this.help = (first && this.helps.get(first)) ?? { title: sub.label, text: () => sub.help(this.state()) };
    });
  }

  step(by: number) {
    const tops = SECTIONS.map(({ id }) => id);
    this.show(tops[(tops.indexOf(this.top()) + by + tops.length) % tops.length]);
  }

  reset() {
    for (const key of this.keys()) this.set(key, DEFAULT_SETTINGS[key]);
  }
}

const KEY = Symbol("settings-nav");

export const provide_nav = (nav: SettingsNav) => setContext(KEY, nav);
export const use_nav = () => getContext<SettingsNav>(KEY);
