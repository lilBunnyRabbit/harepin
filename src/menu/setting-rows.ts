export type Text = string | (() => string);

export interface Value<T> {
  get(): T;
  set(value: T): void;
}

export type Options<T> = readonly (readonly [T, string])[];

export interface RowHelp {
  title: string;
  text: Text;
  visual?: () => Node | null;
}

export interface SliderOptions {
  step?: number;
  enabled?: () => boolean;
  /** Readout suffix after the rounded value. */
  unit?: string;
  min?: number;
  max?: number;
  /** Readout in place of the rounded value and unit. */
  format?: (value: number) => string;
}

export const ADJUST_EVENT = "adjust";

export const read = (text: Text) => (typeof text === "string" ? text : text());

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, class_name = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (class_name) node.className = class_name;
  if (text) node.textContent = text;
  return node;
}

export function icon(id: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${id}`);
  svg.append(use);
  return svg;
}

// The row holds focus, not its inner controls, so the pad and arrow keys move row by row and left / right changes the value.
function inner(tag: "button", class_name = "", text = ""): HTMLButtonElement {
  const button = el(tag, class_name, text);
  button.type = "button";
  button.tabIndex = -1;
  return button;
}

export class Rows {
  on_focus: ((help: RowHelp) => void) | null = null;
  private readonly syncs: (() => void)[] = [];
  private readonly helps = new WeakMap<HTMLElement, RowHelp>();

  help_of(row: Element | null): RowHelp | null {
    return row instanceof HTMLElement ? (this.helps.get(row) ?? null) : null;
  }

  refresh() {
    for (const sync of this.syncs) sync();
  }

  segmented<T>(label: string, help: Text, value: Value<T>, options: Options<T>, visual?: () => Node | null): HTMLElement {
    const group = el("div", "settings-choice");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", label);
    const buttons = options.map(([option, text]) => {
      const button = inner("button", "", text);
      button.setAttribute("role", "radio");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        value.set(option);
      });
      group.append(button);
      return [option, button] as const;
    });
    this.syncs.push(() => {
      for (const [option, button] of buttons) button.setAttribute("aria-checked", String(value.get() === option));
    });
    const at = () => options.findIndex(([option]) => option === value.get());
    const step = (by: number) => value.set(options[Math.max(0, Math.min(options.length - 1, at() + by))][0]);
    return this.row(label, { title: label, text: help, visual }, group, step, () => value.set(options[(at() + 1) % options.length][0]));
  }

  stepper<T>(label: string, help: Text, value: Value<T>, options: Options<T> | (() => Options<T>), visual?: () => Node | null, accept?: () => void): HTMLElement {
    const list = typeof options === "function" ? options : () => options;
    const wrap = el("div", "row-step");
    const prev = inner("button", "row-arrow");
    prev.setAttribute("aria-label", `Previous ${label.toLowerCase()}`);
    prev.append(icon("icon-back"));
    const next = inner("button", "row-arrow");
    next.setAttribute("aria-label", `Next ${label.toLowerCase()}`);
    next.append(icon("icon-steer-right"));
    const shown = el("span", "row-step-value");
    const name = el("b");
    const dots = el("span", "row-dots");
    dots.setAttribute("aria-hidden", "true");
    shown.append(name, dots);
    wrap.append(prev, shown, next);
    const step = (by: number) => {
      const all = list();
      const at = all.findIndex(([option]) => option === value.get());
      value.set(all[(at + by + all.length) % all.length][0]);
    };
    prev.addEventListener("click", (event) => {
      event.stopPropagation();
      step(-1);
    });
    next.addEventListener("click", (event) => {
      event.stopPropagation();
      step(1);
    });
    this.syncs.push(() => {
      const all = list();
      const at = all.findIndex(([option]) => option === value.get());
      name.textContent = all[at]?.[1] ?? "";
      // Dots only while they still read as a position; a long theme list would be a smear.
      dots.replaceChildren(...(all.length <= 8 ? all.map((_, i) => el("i", i === at ? "on" : "")) : []));
    });
    return this.row(label, { title: label, text: help, visual }, wrap, step, accept ?? (() => step(1)));
  }

  toggle(label: string, help: Text, value: Value<boolean>): HTMLElement {
    const button = inner("button", "settings-switch");
    button.setAttribute("role", "switch");
    button.setAttribute("aria-label", label);
    button.append(el("span", "settings-knob"));
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      value.set(!value.get());
    });
    this.syncs.push(() => button.setAttribute("aria-checked", String(value.get())));
    return this.row(label, { title: label, text: help }, button, (by) => value.set(by > 0), () => value.set(!value.get()));
  }

  slider(label: string, help: Text, value: Value<number>, { step = 5, enabled = () => true, unit = "%", min = 0, max = 100, format }: SliderOptions = {}): HTMLElement {
    const wrap = el("div", "row-slider");
    const range = el("input", "settings-range");
    range.type = "range";
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.tabIndex = -1;
    range.setAttribute("aria-label", label);
    const readout = el("b", "settings-number");
    range.addEventListener("input", () => value.set(Number(range.value)));
    range.addEventListener("click", (event) => event.stopPropagation());
    this.syncs.push(() => {
      const now = value.get();
      if (document.activeElement !== range) range.value = String(now);
      readout.textContent = format ? format(now) : `${Math.round(now)}${unit}`;
      range.disabled = !enabled();
      range.style.setProperty("--fill", `${((now - min) / (max - min)) * 100}%`);
    });
    wrap.append(range, readout);
    const nudge = (by: number) => value.set(Math.max(min, Math.min(max, value.get() + by * step)));
    return this.row(label, { title: label, text: help }, wrap, nudge, () => {});
  }

  link(label: string, help: Text, shown: Text, open: () => void): HTMLElement {
    const wrap = el("span", "row-link");
    const text = el("span");
    this.syncs.push(() => (text.textContent = read(shown)));
    wrap.append(text, icon("icon-steer-right"));
    const row = this.row(label, { title: label, text: help }, wrap, null, open);
    row.setAttribute("role", "button");
    return row;
  }

  action(label: string, help: Text, control: HTMLElement, accept: () => void): HTMLElement {
    const row = this.row(label, { title: label, text: help }, control, null, accept);
    row.setAttribute("role", "button");
    return row;
  }

  info(label: string, help: Text, shown: Text, visual?: () => Node | null): HTMLElement {
    const text = el("span", "row-info");
    this.syncs.push(() => (text.textContent = read(shown)));
    return this.row(label, { title: label, text: help, visual }, text, null, null);
  }

  custom(label: string, help: Text, control: HTMLElement): HTMLElement {
    const row = el("div", "row row-custom");
    row.append(el("span", "row-label", label), control);
    this.helps.set(row, { title: label, text: help });
    row.addEventListener("focusin", () => this.on_focus?.({ title: label, text: help }));
    return row;
  }

  private row(label: string, help: RowHelp, control: HTMLElement, adjust: ((by: number) => void) | null, accept: (() => void) | null): HTMLElement {
    const row = el("div", "row");
    row.append(el("span", "row-label", label), control);
    this.helps.set(row, help);
    row.tabIndex = 0;
    if (accept) {
      row.addEventListener("click", accept);
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        accept();
      });
    }
    if (adjust) {
      row.dataset.adjust = "";
      row.addEventListener(ADJUST_EVENT, (event) => adjust((event as CustomEvent<number>).detail));
    }
    row.addEventListener("focusin", () => this.on_focus?.(help));
    return row;
  }
}
