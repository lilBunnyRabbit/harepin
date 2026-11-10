export interface LobbyStartSteps {
  /** Puts the car on the circuit spawn once its ground is in. */
  restart(): Promise<void>;
  /** Clears lap, nitro and rewind state without moving the car. */
  reset(): void;
  /** Starts the lobby's race on `route`, which places the car on its own start. */
  race(route: string): void;
}

// A route race places the car itself, synchronously; an async restart to the circuit spawn landing after it would
// move every racer off their start. So only the circuit restarts.
export function start_lobby(route: string, steps: LobbyStartSteps): Promise<void> {
  if (route === "circuit") return steps.restart();
  steps.reset();
  steps.race(route);
  return Promise.resolve();
}
