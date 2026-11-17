import { mount } from "svelte";
import ResultNext from "./ResultNext.svelte";
import type { NextCard } from "./result";

/** A finish order or a cup's stages: rows the run keeps current while the card shows. */
export interface ResultTable {
  title: string;
  rows: HTMLElement[];
}

/** What a finished run puts on the results page. */
export interface ResultCard {
  /** The mode, over the heading. */
  eyebrow: string;
  /** The run's name. */
  title: string;
  /** The big line: a place where cars raced, else how the run ended. */
  stamp: string;
  /** The stamp is a place ("2nd"), drawn as a number with its suffix raised. */
  placed: boolean;
  stars: number;
  lines: HTMLElement[];
  table: ResultTable | null;
  unlock: HTMLElement[];
  can_change_car: boolean;
  can_try: boolean;
}

export interface ResultHost {
  go(): void;
  leave(): void;
  retry(): void;
  change_car(): void;
  try_on(): void;
  /** A menu is open over the page: its keys are the menu's. */
  covered(): boolean;
}

export class ResultNextView {
  card = $state.raw<ResultCard | null>(null);
  /** Why a Next or a Restart was refused. */
  note = $state("");
  label = $state("");
  shown = $state(false);
  disabled = $state(false);
  ticket = $state<NextCard | null>(null);
  /** Counts shows, so a card shown again takes focus again. */
  opened = $state(0);

  constructor(readonly host: ResultHost) {}

  go() {
    this.host.go();
  }

  show(label: string, disabled = false, ticket: NextCard | null = null) {
    this.label = label;
    this.disabled = disabled;
    this.ticket = ticket;
    this.shown = true;
    this.opened++;
  }

  hide() {
    this.shown = false;
    this.ticket = null;
  }

  mount(target: HTMLElement) {
    mount(ResultNext, { target, props: { view: this } });
  }
}
