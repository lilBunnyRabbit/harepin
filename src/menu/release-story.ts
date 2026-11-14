import { CARS, car_sized, is_car, type CarId } from "../car/cars";
import { PLAIN_CARS } from "../career/rewards";
import { TEASE, type Highlight, type Release } from "../changelog";

/** The cars a player starts with, less the ones too big to stand in a row of cars. */
const LINEUP: readonly CarId[] = PLAIN_CARS.filter((car) => car_sized(CARS[car]));
const TOP_LINES = 3;
const BANNER_CARS = 2;

export interface CarCard {
  highlight: Highlight;
  /** Null until this build has the car: the card holds its place. */
  car: CarId | null;
}

export type StoryBlock =
  | { type: "cars"; head: Highlight; cards: CarCard[] }
  | { type: "pairs"; head: Highlight; cars: CarId[] }
  | { type: "tease"; highlight: Highlight; car: CarId | null }
  | { type: "also"; items: Highlight[] };

export interface Story {
  /** The updated card's lines. */
  tops: Highlight[];
  /** Lit cars for the card's banner, never the tease's. */
  banner: CarId[];
  tease: CarId | null;
  /** The row of cars under the title. */
  lineup: readonly CarId[];
  blocks: StoryBlock[];
}

const car_of = (highlight: Highlight): CarId | null => (highlight.car !== undefined && is_car(highlight.car) ? highlight.car : null);
const is_card = (highlight: Highlight) => highlight.kind !== TEASE && highlight.car !== undefined && !highlight.was;

export function story_of(release: Release): Story | null {
  const highlights = release.highlights ?? [];
  if (!highlights.length) return null;
  const blocks: StoryBlock[] = [];
  const also: Highlight[] = [];
  const tease = highlights.find((highlight) => highlight.kind === TEASE);
  const teased = tease ? car_of(tease) : null;
  // A teased car stays an outline everywhere, a card of it included.
  const lit = (highlight: Highlight) => {
    const car = car_of(highlight);
    return car === teased ? null : car;
  };
  for (let i = 0; i < highlights.length; i++) {
    const highlight = highlights[i];
    if (highlight.kind === TEASE) {
      blocks.push({ type: "tease", highlight, car: car_of(highlight) });
    } else if (highlight.was) {
      const car = lit(highlight);
      blocks.push({ type: "pairs", head: highlight, cars: highlight.car === undefined ? LINEUP.filter((id) => id !== teased) : car ? [car] : [] });
    } else if (is_card(highlight)) {
      blocks.push({ type: "cars", head: highlight, cards: [{ highlight, car: lit(highlight) }] });
    } else {
      const cards: CarCard[] = [];
      while (i + 1 < highlights.length && is_card(highlights[i + 1])) cards.push({ highlight: highlights[++i], car: lit(highlights[i]) });
      if (cards.length) blocks.push({ type: "cars", head: highlight, cards });
      else also.push(highlight);
    }
  }
  if (also.length) blocks.push({ type: "also", items: also });

  const shown = blocks.flatMap((block) => (block.type === "cars" ? block.cards.flatMap((card) => (card.car ? [card.car] : [])) : []));
  const banner = [...new Set([...shown, ...LINEUP])].filter((car) => car !== teased);
  const tops = highlights.filter((highlight) => !is_card(highlight)).slice(0, TOP_LINES);
  return { tops, banner: banner.slice(0, BANNER_CARS), tease: teased, lineup: LINEUP.filter((car) => car !== teased), blocks };
}
