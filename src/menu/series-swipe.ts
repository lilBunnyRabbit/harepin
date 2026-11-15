import type { Action } from "svelte/action";

const SWIPE_START = 12;
const SWIPE_STEP = 40;

// A press that never travels stays a tap, so buttons inside keep their clicks.
export const swipe: Action<HTMLElement, (dir: 1 | -1) => void> = (node, step) => {
  let start_x = 0;
  let start_y = 0;
  let id: number | null = null;
  let dragging = false;
  let last_x = 0;

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    id = e.pointerId;
    start_x = last_x = e.clientX;
    start_y = e.clientY;
    dragging = false;
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    last_x = e.clientX;
    if (dragging || Math.abs(e.clientX - start_x) < SWIPE_START || Math.abs(e.clientX - start_x) < Math.abs(e.clientY - start_y)) return;
    dragging = true;
    node.setPointerCapture(e.pointerId);
  };
  const lost = () => {
    const dx = last_x - start_x;
    if (dragging && Math.abs(dx) >= SWIPE_STEP) step(dx < 0 ? 1 : -1);
    dragging = false;
    id = null;
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId === id && !dragging) id = null;
  };
  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("lostpointercapture", lost);
  return {
    update: (next) => (step = next),
    destroy() {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("lostpointercapture", lost);
    },
  };
};
