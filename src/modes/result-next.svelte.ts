import { mount } from "svelte";
import ResultNext from "./ResultNext.svelte";
import type { NextTicket } from "./result";

export class ResultNextView {
  label = $state("");
  shown = $state(false);
  disabled = $state(false);
  ticket = $state<NextTicket | null>(null);
  /** Counts shows, so a card shown again takes focus again. */
  opened = $state(0);

  constructor(
    readonly go: () => void,
    readonly leave: () => void,
  ) {}

  show(label: string, disabled = false, ticket: NextTicket | null = null) {
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
    mount(ResultNext, { target, props: { next: this } });
  }
}
