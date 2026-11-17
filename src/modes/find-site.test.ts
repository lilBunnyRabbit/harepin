import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { World } from "../world/world";
import { build_world, plain_map } from "../worldgen/kinds/kinds";
import { SPAWN_INDEX, type WorldKind } from "../worldgen/types";
import { find_site, type Site } from "./gymkhana";
import { park_footprint } from "./parking";

type Row = [x: number, y: number, z: number, heading: number] | null;

interface Found {
  kind: WorldKind;
  seed: number;
  gym: Row;
  park: Row;
}

// Recorded at b459b34, before the search took each site's sine and cosine once; raceway 0 re-recorded with the venue (look C), which moved its gymkhana site. A faster search finds the same sites, to the bit.
const FOUND: Found[] = [
  { kind: "island", seed: 0, gym: [42.4917932377763, 25.2910972279705, 754.9184963231713, -1.716229949961617], park: [-92.11499183304663, 54.39022242930562, 590.4236629461586, -2.0027323921603006] },
  { kind: "island", seed: 1, gym: [-665.7805340708346, 30.566353797162087, 310.04167095019665, -2.2064200225698274], park: [-685.7877078392625, 30.34654244334346, 307.2985718563806, -2.1680509058872373] },
  { kind: "island", seed: 2, gym: [425.2702081330719, 26.865854799557933, -605.8641888271184, 1.5399401372027413], park: [433.0697909675003, 27.80637136158057, -575.5416690479051, 1.5196132527924409] },
  { kind: "tundra", seed: 0, gym: [523.8607608842929, 11.970969609040205, -189.28238659109593, -0.22215229249683552], park: [626.1128648328855, 13.200409036675014, -121.29632847410085, 0.1532045156011171] },
  { kind: "tundra", seed: 1, gym: [612.4565870003755, 9.50776066369724, -287.34591585496474, -0.09304862208877318], park: [602.5551610568604, 9.527603983853735, -224.2850455822092, -0.09914892159148544] },
  { kind: "tundra", seed: 2, gym: [635.509585420826, 9.162533454537883, 56.11161792283456, 0.7090276491999413], park: [611.2434037555522, 7.608007452163878, -256.62418189397727, -0.049912990622601495] },
  { kind: "volcano", seed: 0, gym: null, park: [110.19956900406012, 191.03530883789062, -30.755456192038075, 0.18255386895663778] },
  { kind: "volcano", seed: 1, gym: [119.49089658405654, 194.37189084243423, -4.529606186424324, -0.42305619610951956], park: [107.6685288570781, 194.3717498779297, 17.71677170507827, -0.3178287500708776] },
  { kind: "volcano", seed: 2, gym: null, park: [106.22881674510394, 193.88385009765625, -36.58293114774487, 0.22345288314988798] },
  { kind: "raceway", seed: 0, gym: [-233.22478050687104, 53.56309144407072, -563.7066899252196, 1.2258452079385345], park: [-345.8030057535952, 54.57235536092346, -449.9165450618091, 2.227039037592161] },
  { kind: "raceway", seed: 1, gym: [-420.45122879925844, 36.68261972423671, 508.88965301188773, -2.51582838487141], park: [-444.6670695893548, 36.70577022035603, 490.4088410002562, -2.702770489914953] },
  { kind: "raceway", seed: 2, gym: [-463.15699427316554, 45.62919579825552, -401.4880831167539, -0.32239235788148357], park: [-363.58002332449416, 46.24243395387489, -356.1110080890494, -0.25415558053544757] },
];

const row = (site: Site | null): Row => (site ? [site.x, site.y, site.z, site.heading] : null);

const AREA = park_footprint();

for (const { kind, seed, gym, park } of FOUND)
  test(`the site search finds the recorded sites, to the bit: ${kind} ${seed}`, () => {
    const map = plain_map(kind, seed);
    const world = new World(map.seed, build_world(map.seed, map.kind, map.levels).data, undefined, map.levels);
    expect(row(find_site(world, SPAWN_INDEX))).toEqual(gym);
    expect(row(find_site(world, SPAWN_INDEX, AREA))).toEqual(park);
  });
