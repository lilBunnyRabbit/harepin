import type { CarShelf } from "../car/car-pick";

/** The menu id of the full-screen car picker. */
export const CAR_PAGE = "car";

/** One open ask for a car: the picker page shows it and ends it with a pick, or with null when the player leaves; whoever asked then moves the menu on. */
export interface CarAsk {
  /** Where the pick is for: the event's name, or the Garage. */
  title: string;
  /** The class the cars must meet, in words. */
  limit: string;
  shelves: readonly CarShelf[];
  /** A line beside the button on what the pick is for. */
  note: string;
  /** Where Back leads, for the crumb: the menu page that asked, or the road. */
  back: string;
}

export class CarPicker {
  ask = $state.raw<CarAsk | null>(null);
  private done: ((code: string | null) => void) | null = null;

  /** Opens an ask; one still open ends unpicked. */
  open(ask: CarAsk): Promise<string | null> {
    this.end(null);
    this.ask = ask;
    return new Promise((done) => (this.done = done));
  }

  get open_ask(): boolean {
    return this.done !== null;
  }

  end(code: string | null) {
    const done = this.done;
    this.done = null;
    done?.(code);
  }
}
