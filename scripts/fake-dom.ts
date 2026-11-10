import { seed_of } from "../src/rng";

// palette.ts reads theme tokens from the DOM on import; each token here hashes its name into a stable fake colour.
const style = { setProperty() {} };
Object.assign(globalThis, {
  location: { search: "" },
  localStorage: { getItem: () => null, setItem() {} },
  getComputedStyle: (el: { style: { color: string } }) => ({ color: el.style.color }),
  document: {
    documentElement: { style },
    body: { append() {} },
    createElement: () => {
      let fill = "";
      return {
        style: { color: "" },
        remove() {},
        getContext: () => ({
          set fillStyle(v: string) {
            fill = v;
          },
          clearRect() {},
          fillRect() {},
          getImageData: () => {
            const h = seed_of(fill);
            return { data: [h & 255, (h >>> 8) & 255, (h >>> 16) & 255, 255] };
          },
        }),
      };
    },
  },
});
