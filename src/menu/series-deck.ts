export const DeckLayout = {
  ROAD: "road",
  PILE: "pile",
  RING: "ring",
  LANE: "lane",
  ARC: "arc",
} as const;
export type DeckLayout = (typeof DeckLayout)[keyof typeof DeckLayout];

export interface Slot {
  transform: string;
  z: number;
  dim: boolean;
}

/** `k` is the card's place relative to the focused one: 0 focused, 1 the next event, -1 the one before. */
type Place = (k: number, i: number, n: number) => Slot;

// A fixed jitter per event, so a pile keeps its look between visits.
const jitter = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

const CENTER = "translate(-50%, -50%)";

const PLACES: Record<DeckLayout, Place> = {
  road: (k) => {
    if (k === 0) return { transform: `${CENTER} rotateY(6deg)`, z: 100, dim: false };
    if (k > 0) return { transform: `${CENTER} translate3d(${k * 80 + 10}%, ${-k * 3}%, ${-k * 24}cqh) rotateY(${Math.min(10 + k * 8, 40)}deg)`, z: 100 - k, dim: false };
    return { transform: `${CENTER} translate3d(${-112 + (k + 1) * 14}%, ${6 - (k + 1) * 4}%, -22cqh) rotateY(-18deg) scale(0.8)`, z: 50 + k, dim: true };
  },
  pile: (k, i) => {
    if (k === 0) return { transform: `${CENTER} rotate(-1.5deg)`, z: 100, dim: false };
    if (k > 0) return { transform: `${CENTER} translate3d(${k * 9 + jitter(i, 1) * 4}%, ${-k * 5 + jitter(i, 2) * 3}%, ${-k * 2}cqh) rotate(${jitter(i, 3) * 9}deg)`, z: 100 - k, dim: false };
    return { transform: `${CENTER} translate3d(${-118 + jitter(i, 4) * 10}%, ${8 + jitter(i, 5) * 10}%, -4cqh) rotate(${jitter(i, 6) * 14}deg) scale(0.78)`, z: 60 + k, dim: true };
  },
  ring: (k, _i, n) => {
    const angle = (k * 360) / n - 32;
    return { transform: `${CENTER} translateZ(-40cqw) rotateY(${angle}deg) translateZ(40cqw) rotateY(${-angle * 0.85}deg)`, z: 100 - Math.abs(k), dim: k !== 0 };
  },
  lane: (k) => {
    if (k < 0) return { transform: `${CENTER} translate3d(${-150 + (k + 1) * 10}%, 30%, 10cqh) rotateY(-40deg) scale(0.7)`, z: 40 + k, dim: true };
    if (k === 0) return { transform: `${CENTER} translate3d(-62%, 0, 0) rotateY(14deg)`, z: 100, dim: false };
    const side = k % 2 === 1 ? 1 : -1;
    return { transform: `${CENTER} translate3d(${side * 95}%, ${-k * 3}%, ${-k * 26}cqh) rotateY(${-side * 38}deg)`, z: 100 - k, dim: false };
  },
  arc: (k) => ({ transform: `${CENTER} translateZ(60cqw) rotateY(${-k * 30}deg) translateZ(-60cqw) scale(${k === 0 ? 1 : 0.85})`, z: 100 - Math.abs(k), dim: k !== 0 }),
};

export const deck_slot = (layout: DeckLayout, k: number, i: number, n: number): Slot => PLACES[layout](k, i, n);
