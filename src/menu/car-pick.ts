import { mount, unmount } from "svelte";
import type { CarShelf } from "../car/car-pick";
import CarPick from "./CarPick.svelte";

/** `ongarage`: the dialog's Garage link, run after it closes as a cancel. */
export function pick_car(title: string, limit: string, shelves: readonly CarShelf[], signal: AbortSignal, ongarage?: () => void): Promise<string | null> {
  return new Promise((done) => {
    const target = document.createElement("div");
    document.body.append(target);
    const shown = mount(CarPick, { target, props: { title, limit, shelves, onpick, ongarage } });
    // The car sits under the card: keys stay in it instead of steering.
    target.addEventListener("keydown", (event) => event.stopPropagation());
    target.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLDialogElement)) return;
      const box = event.target.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!inside) shown.close();
    });
    const abort = () => shown.close();
    signal.addEventListener("abort", abort, { once: true });

    function onpick(code: string | null) {
      signal.removeEventListener("abort", abort);
      void unmount(shown);
      target.remove();
      done(signal.aborted ? null : code);
    }
  });
}
