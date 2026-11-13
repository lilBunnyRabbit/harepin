export interface Tab<T extends string> {
  id: T;
  label: string;
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
}
