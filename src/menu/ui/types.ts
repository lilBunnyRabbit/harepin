export interface Tab<T extends string> {
  id: T;
  label: string;
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** What to press, per input: a key name, a pad button label (one letter draws round, a shoulder like RT a bumper), a touch icon id. */
export interface GlyphKeys {
  key?: string;
  pad?: string;
  touch?: string;
}

/** One line on a ticket saying why this event is next, with an optional quieter second line. */
export interface Reason {
  text: string;
  note?: string;
}
